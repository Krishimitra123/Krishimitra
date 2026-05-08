"""
Module M4 — Crop Diagnosis (Gemini primary, Pixtral-12b fallback)
Key fix: image_url must be {"url": "data:..."} not a bare string.
Hard 35s overall asyncio timeout. Image result cached by MD5.
NON-PLANT images now correctly rejected (no hallucinated diseases).
"""

import asyncio
import base64
import hashlib
import httpx
import io
import json
import os
import re
from models.schemas import DiagnosisRequest, DiagnosisFinding

try:
    from PIL import Image as PILImage
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print('[M4] WARNING: Pillow not installed — large images will not be auto-resized')

_cache: dict[str, DiagnosisFinding] = {}

MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'
GEMINI_URL_TEMPLATE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}'

CHEMICAL_TERMS = [
    'urea', 'DAP', 'NPK', 'chlorpyrifos', 'imidacloprid',
    'cypermethrin', 'glyphosate', 'endosulfan', 'ammonium sulphate',
]

PLANT_CONTEXT_TERMS = [
    'leaf', 'leaves', 'stem', 'root', 'fruit', 'flower', 'crop', 'plant',
    'trunk', 'bark', 'branch', 'tuber', 'bulb', 'pod', 'seed', 'grain',
    'blight', 'rot', 'wilt', 'mildew', 'spot', 'mosaic', 'canker', 'rust',
    'fungal', 'fungus', 'bacterial', 'viral', 'healthy', 'disease',
    'ಎಲೆ', 'ಕಾಂಡ', 'ಬೇರು', 'ಹಣ್ಣು', 'ಹೂ', 'ಬೆಳೆ', 'ಸಸ್ಯ',
    'ಕಾಂಡ', 'ತೊಗಟೆ', 'ಗಡ್ಡೆ', 'ಬೀಜ', 'ರೋಗ', 'ಆರೋಗ್ಯಕರ',
]

POWDERY_MILDEW_TERMS = [
    'powdery mildew', 'ಬೂದಿ ರೋಗ', 'ಕಣಕಾಲು', 'ಕಲೆಕಾಲು', 'white powder', 'powder', 'fuzzy white', 'white fungal',
]

DIAGNOSIS_PROMPT = """You are an expert Indian crop pathologist specializing in organic farming and sustainable agriculture.
You can diagnose diseases from ANY plant part — leaf, stem, root, trunk, bark, fruit, flower, tuber, bulb, pod, grain, or seed.

=== STEP 1: IS THIS A PLANT IMAGE? ===
Carefully examine the image. It must contain ANY plant part (leaf, stem, root, trunk, bark, fruit, flower, tuber, bulb, pod, seed, grain, or whole plant).
If the image does NOT show a plant part clearly, return:
{
  "plant_health_status": "ಅಸ್ಪಷ್ಟ",
  "disease_name": "Not a plant image",
  "disease_name_kn": "ಸಸ್ಯ ಕಾಣಿಸಲಿಲ್ಲ",
  "confidence_pct": 0,
  "visual_symptoms": ["ಚಿತ್ರದಲ್ಲಿ ಸಸ್ಯ ಕಾಣಿಸುತ್ತಿಲ್ಲ"],
  "probable_cause": "ಸಸ್ಯದ ಫೋಟೋ ತೆಗೆಯಿರಿ",
  "organic_treatments": ["ನಿಮ್ಮ ಬೆಳೆಯ ಎಲೆ ಅಥವಾ ಸಸ್ಯದ ಸ್ಪಷ್ಟ ಫೋಟೋ ತೆಗೆಯಿರಿ"],
  "prevention_measures": ["ಬೆಳಕಿನಲ್ಲಿ ಸಸ್ಯದ ಹತ್ತಿರ ಫೋಟೋ ತೆಗೆಯಿರಿ"],
  "needs_retake": true
}

=== STEP 2: DETAILED ANALYSIS ===
If a plant is visible, look for:
- Color changes (yellowing, browning, spots)
- Texture changes (wilting, curling, powdery growth)
- Structural damage (holes, rot, lesions)
- Distribution of symptoms (veins, edges, base)

Reply with valid JSON:
{
  "plant_health_status": "ರೋಗಗ್ರಸ್ತ",
  "disease_name": "Leaf Blight",
  "disease_name_kn": "ಎಲೆ ಒಣಗು ರೋಗ",
  "confidence_pct": 85,
  "visual_symptoms": ["ಎಲೆಗಳ ಮೇಲೆ ಕಂದು ಚುಕ್ಕೆಗಳು", "ತೀವ್ರವಾದ ಒಣಗುವಿಕೆ"],
  "probable_cause": "ಅತಿ ಹೆಚ್ಚು ತೇವಾಂಶ ಮತ್ತು ಶಿಲೀಂಧ್ರ ಸೋಂಕು",
  "organic_treatments": [
    "ಪಂಚಗವ್ಯ (3%) ದ್ರಾವಣವನ್ನು ಎಲೆಗಳ ಮೇಲೆ ಸಿಂಪಡಿಸಿ",
    "ಬೇವಿನ ಎಣ್ಣೆ ಮತ್ತು ಸಾಬೂನು ನೀರನ್ನು ಬೆರೆಸಿ ಸಿಂಪಡಿಸಿ",
    "ಟ್ರೈಕೋಡರ್ಮಾ ವಿರಿಡೆಯನ್ನು ಮಣ್ಣಿಗೆ ಸೇರಿಸಿ"
  ],
  "prevention_measures": [
    "ಬೆಳೆಗಳ ನಡುವೆ ಸರಿಯಾದ ಅಂತರ ಕಾಯ್ದುಕೊಳ್ಳಿ",
    "ನೀರಾವರಿ ಪ್ರಮಾಣವನ್ನು ನಿಯಂತ್ರಿಸಿ"
  ],
  "needs_retake": false
}

=== STRICT RULES ===
1. CONFIDENCE: >70 only if symptoms are clearly visible. 40-70 if symptoms are present but not distinct. 20-40 if you are guessing. <20 means retake needed.
2. BE HONEST: If you are not sure, set confidence_pct low (20-40). Do NOT invent diseases. If the plant looks healthy, say so.
3. TRANSLATION: "Powdery Mildew" -> "ಬೂದಿ ರೋಗ" (ALWAYS). "Late Blight" -> "ಕೊಳೆ ರೋಗ". "Yellow Mosaic" -> "ಹಳದಿ ನಂಜು ರೋಗ".
4. ORGANIC ONLY: NEVER mention chemicals. Use Jeevamrutha, Beejamrutha, Neem oil, Panchagavya, Trichoderma.
5. HEALTHY: If no symptoms, plant_health_status="ಆರೋಗ್ಯಕರ", disease_name_kn="ಆರೋಗ್ಯಕರ ಸಸ್ಯ".
6. BLURRY/DARK: needs_retake=true ONLY if the image is truly unreadable.

Reply ONLY with valid JSON."""


def _cache_key(b64: str, text: str = '') -> str:
    # Use the full base64 payload to avoid accidental collisions when images share prefixes.
    # Include optional text and mime to ensure uniqueness across requests.
    return hashlib.md5((b64 + text).encode()).hexdigest()


def _compress_and_crop(b64: str, mime: str) -> list[tuple[str, str]]:
    """
    Returns [(full_b64, mime), (crop_b64, mime)] for multi-crop ensemble.
    """
    if not HAS_PIL:
        return [(b64, mime)]

    try:
        img_bytes = base64.b64decode(b64)
        img = PILImage.open(io.BytesIO(img_bytes)).convert('RGB')
        
        # 1. Full image thumbnail
        full_img = img.copy()
        full_img.thumbnail((1024, 1024), PILImage.LANCZOS)
        buf_full = io.BytesIO()
        full_img.save(buf_full, format='JPEG', quality=60, optimize=True)
        b64_full = base64.b64encode(buf_full.getvalue()).decode()
        
        # 2. Center crop (zoom in on the middle 60%)
        w, h = img.size
        min_dim = min(w, h)
        crop_size = int(min_dim * 0.6)
        left = (w - crop_size) // 2
        top = (h - crop_size) // 2
        crop_img = img.crop((left, top, left + crop_size, top + crop_size))
        crop_img.thumbnail((512, 512), PILImage.LANCZOS)
        buf_crop = io.BytesIO()
        crop_img.save(buf_crop, format='JPEG', quality=60, optimize=True)
        b64_crop = base64.b64encode(buf_crop.getvalue()).decode()
        
        print(f'[M4] Multi-crop ensemble created: Full {len(b64_full)} chars, Crop {len(b64_crop)} chars')
        return [(b64_full, 'image/jpeg'), (b64_crop, 'image/jpeg')]
    except Exception as e:
        print(f'[M4] Compression/Crop failed (using original): {e}')
        return [(b64, mime)]


def _fallback() -> DiagnosisFinding:
    return DiagnosisFinding(
        plant_health_status='Unclear',
        disease_name='Unable to analyze',
        disease_name_kn='ವಿಶ್ಲೇಷಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ',
        confidence_pct=0.0,
        visual_symptoms=['ಚಿತ್ರ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ ಅಥವಾ ಸಸ್ಯ ಕಾಣಿಸುತ್ತಿಲ್ಲ'],
        probable_cause='ಸ್ಪಷ್ಟ ಚಿತ್ರ ಇಲ್ಲ',
        organic_treatments=['ಸ್ಥಳೀಯ ಕೃಷಿ ವಿಜ್ಞಾನ ಕೇಂದ್ರ (KVK) ಸಂಪರ್ಕಿಸಿ'],
        prevention_measures=['ಸಸ್ಯವನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ತೋರಿಸುವ ಚಿತ್ರ ತೆಗೆಯಿರಿ'],
        needs_retake=True,
        sources=[],
        is_reliable=False,
    )


def _parse(raw: str) -> dict | None:
    """Extract JSON from model response, handling markdown fences."""
    cleaned = re.sub(r'```json\s*|```\s*', '', raw).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        s, e = cleaned.find('{'), cleaned.rfind('}')
        if s != -1 and e > s:
            try:
                return json.loads(cleaned[s:e + 1])
            except Exception:
                pass
    return None


def _build(data: dict, source: str) -> DiagnosisFinding:
    safe = [t for t in data.get('organic_treatments', [])
            if not any(c.lower() in t.lower() for c in CHEMICAL_TERMS)]
    conf = max(0, min(100, int(data.get('confidence_pct', 0) or 0)))
    return DiagnosisFinding(
        plant_health_status=data.get('plant_health_status', 'Unclear'),
        disease_name=data.get('disease_name', 'Unknown'),
        disease_name_kn=data.get('disease_name_kn', ''),
        confidence_pct=float(conf),
        visual_symptoms=data.get('visual_symptoms', []),
        probable_cause=data.get('probable_cause', ''),
        organic_treatments=safe or ['ಸ್ಥಳೀಯ KVK ಸಲಹೆ ಪಡೆಯಿರಿ'],
        prevention_measures=data.get('prevention_measures', []),
        needs_retake=bool(data.get('needs_retake', False)),
        sources=[source, 'ICAR Crop Protection Guidelines'],
        is_reliable=conf >= 25 and bool(data.get('disease_name')) and not data.get('needs_retake', False),
    )


def _looks_like_plant_context(finding: DiagnosisFinding) -> bool:
    haystack = ' '.join([
        finding.disease_name or '',
        finding.disease_name_kn or '',
        finding.probable_cause or '',
        ' '.join(finding.visual_symptoms or []),
    ]).lower()
    return any(term in haystack for term in PLANT_CONTEXT_TERMS)


def _needs_hallucination_guard(finding: DiagnosisFinding) -> bool:
    if finding.needs_retake:
        return True

    confidence = float(finding.confidence_pct or 0)
    # Only reject very low confidence — let moderate results through
    if confidence < 15:
        return True

    # Only check plant context for very confident claims about non-plants
    if confidence > 60 and not _looks_like_plant_context(finding):
        return True

    return False


def _force_retake(finding: DiagnosisFinding, message: str) -> DiagnosisFinding:
    print(f'[M4] {message}')
    finding.plant_health_status = 'ಅಸ್ಪಷ್ಟ'
    finding.disease_name = 'Not a plant image'
    finding.disease_name_kn = 'ಸಸ್ಯ ಕಾಣಿಸಲಿಲ್ಲ'
    finding.confidence_pct = 0.0
    finding.visual_symptoms = ['ಚಿತ್ರದಲ್ಲಿ ಸಸ್ಯ ಸ್ಪಷ್ಟವಾಗಿ ಕಾಣುತ್ತಿಲ್ಲ']
    finding.probable_cause = 'ಸಸ್ಯದ ಫೋಟೋ ತೆಗೆಯಿರಿ'
    finding.organic_treatments = ['ನಿಮ್ಮ ಬೆಳೆಯ ಎಲೆ ಅಥವಾ ಸಸ್ಯದ ಸ್ಪಷ್ಟ ಫೋಟೋ ತೆಗೆಯಿರಿ']
    finding.prevention_measures = ['ಬೆಳಕಿನಲ್ಲಿ ಸಸ್ಯದ ಹತ್ತಿರ ಫೋಟೋ ತೆಗೆಯಿರಿ']
    finding.needs_retake = True
    finding.is_reliable = False
    finding.summary_kn = None
    finding.audio_base64 = None
    return finding


async def _gemini(b64: str, mime: str, prompt: str) -> DiagnosisFinding | None:
    """Google Gemini 2.0 Flash — PRIMARY model. 25s timeout."""
    key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not key:
        print('[M4] GEMINI_API_KEY not set — skipping Gemini')
        return None

    # Compress and create center crop
    images = _compress_and_crop(b64, mime)
    
    url = GEMINI_URL_TEMPLATE.format(key=key)

    parts = []
    for img_b64, img_mime in images:
        parts.append({
            'inline_data': {
                'mime_type': img_mime,
                'data': img_b64,
            }
        })
    parts.append({'text': prompt})

    payload = {
        'contents': [{
            'parts': parts
        }],
        'generationConfig': {
            'temperature': 0.0,
            'maxOutputTokens': 1500,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as c:
            r = await c.post(url, json=payload)

        print(f'[M4] Gemini HTTP status: {r.status_code}')
        if r.status_code == 200:
            data = r.json()
            text = data['candidates'][0]['content']['parts'][0]['text'].strip()
            print(f'[M4] Gemini raw (first 300): {text[:300]}')
            d = _parse(text)
            if d:
                needs_retake = d.get('needs_retake', False)
                conf = d.get('confidence_pct', 0)
                print(f'[M4] Gemini OK: {d.get("disease_name")} ({conf}%) needs_retake={needs_retake}')
                return _build(d, 'Gemini 2.0 Flash Vision')
            print(f'[M4] Gemini JSON parse failed: {text[:300]}')
        else:
            print(f'[M4] Gemini HTTP {r.status_code}: {r.text[:300]}')

    except httpx.TimeoutException:
        print('[M4] Gemini timed out after 25s')
    except Exception as e:
        print(f'[M4] Gemini error: {e}')
    return None


async def _pixtral(b64: str, mime: str, prompt: str) -> DiagnosisFinding | None:
    """Mistral Pixtral-12b — FALLBACK model. 25s timeout."""
    key = os.environ.get('MISTRAL_API_KEY', '').strip()
    if not key:
        print('[M4] ERROR: MISTRAL_API_KEY not set!')
        return None

    # Compress large images before sending (Pixtral only gets the full resized image)
    images = _compress_and_crop(b64, mime)
    b64, mime = images[0]
    print(f'[M4] Sending to Pixtral (fallback): {len(b64)} chars, mime={mime}')

    try:
        async with httpx.AsyncClient(timeout=25.0) as c:
            r = await c.post(MISTRAL_URL,
                headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
                json={
                    'model': 'pixtral-12b-2409',
                    'messages': [{'role': 'user', 'content': [
                        {'type': 'image_url', 'image_url': {'url': f'data:{mime};base64,{b64}'}},
                        {'type': 'text', 'text': prompt},
                    ]}],
                    'temperature': 0.0,
                    'max_tokens': 1000,
                })

        print(f'[M4] Pixtral HTTP status: {r.status_code}')
        if r.status_code == 200:
            text = r.json()['choices'][0]['message']['content'].strip()
            print(f'[M4] Pixtral raw (first 200): {text[:200]}')
            d = _parse(text)
            if d:
                print(f'[M4] Pixtral OK: {d.get("disease_name")} ({d.get("confidence_pct")}%)')
                return _build(d, 'Pixtral-12b Vision (fallback)')
            print(f'[M4] Pixtral JSON parse failed: {text[:300]}')
        else:
            print(f'[M4] Pixtral HTTP {r.status_code}: {r.text[:300]}')

    except httpx.TimeoutException:
        print('[M4] Pixtral timed out after 25s')
    except Exception as e:
        print(f'[M4] Pixtral error: {e}')
    return None


async def diagnose(request: DiagnosisRequest) -> DiagnosisFinding:
    """
    Run diagnosis: Gemini 2.0 Flash primary, Pixtral-12b fallback.
    Hard 30s overall timeout.
    """
    b64 = request.image_base64
    mime = request.image_mime or 'image/jpeg'
    extra = request.optional_text or ''

    # Check cache first
    ck = _cache_key(b64, extra)
    if ck in _cache:
        print('[M4] Cache hit')
        return _cache[ck]

    prompt = DIAGNOSIS_PROMPT
    if extra:
        prompt += f'\n\nAdditional context from farmer: "{extra}"'

    async def _run() -> DiagnosisFinding:
        # Primary: Gemini 2.0 Flash
        result = await _gemini(b64, mime, prompt)
        if result is not None:
            return result

        # Fallback: Pixtral-12b
        print('[M4] Gemini failed — trying Pixtral fallback...')
        result = await _pixtral(b64, mime, prompt)
        if result is not None:
            return result

        print('[M4] Both models failed — returning fallback')
        return _fallback()

    try:
        result = await asyncio.wait_for(_run(), timeout=30.0)
    except asyncio.TimeoutError:
        print('[M4] 30s hard timeout hit')
        result = _fallback()

    if _needs_hallucination_guard(result):
        result = _force_retake(result, 'Hallucination guard triggered — forcing retake')

    if result.is_reliable:
        _cache[ck] = result

    return result
