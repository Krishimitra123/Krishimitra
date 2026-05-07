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
    'ಎಲೆ', 'ಕಾಂಡ', 'ಬೇರು', 'ಹಣ್ಣು', 'ಹೂ', 'ಬೆಳೆ', 'ಸಸ್ಯ',
]

POWDERY_MILDEW_TERMS = [
    'powdery mildew', 'ಕಣಕಾಲು', 'white powder', 'powder', 'fuzzy white', 'white fungal',
]

DIAGNOSIS_PROMPT = """You are an expert Indian crop pathologist for organic farming.

=== STEP 1: IS THIS A PLANT IMAGE? ===
Before analyzing anything, carefully examine whether the image contains a plant.
If the image does NOT clearly show a plant, leaf, stem, root, flower, fruit, or any crop part,
you MUST immediately return this exact JSON and NOTHING ELSE:
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

This rule applies to ALL of these: human faces, people, animals (cows, dogs, birds),
vehicles (cars, bikes, tractors), buildings, food items, indoor objects, documents,
sky-only, bare soil without plants, or any non-agricultural subject.

=== STEP 2: ANALYZE THE PLANT ===
Only if a plant IS visible, analyze it carefully and reply with this JSON format:
{
  "plant_health_status": "ರೋಗಗ್ರಸ್ತ",
  "disease_name": "Leaf Blight",
  "disease_name_kn": "ಎಲೆ ಒಣಗು ರೋಗ",
  "confidence_pct": 72,
  "visual_symptoms": ["ಎಲೆಗಳ ತುದಿ ಒಣಗಿದೆ", "ಕಂದು ಬಣ್ಣದ ಚುಕ್ಕೆಗಳು ಕಾಣಿಸುತ್ತಿವೆ"],
  "probable_cause": "ಅಧಿಕ ತೇವಾಂಶ ಮತ್ತು ಬ್ಯಾಕ್ಟೀರಿಯಾ ಸೋಂಕು",
  "organic_treatments": [
    "ಪ್ರತಿ 10 ದಿನಕ್ಕೊಮ್ಮೆ ಪಂಚಗವ್ಯ 3% ದ್ರಾವಣ ಸಿಂಪಡಿಸಿ",
    "ಬೇವಿನ ಎಣ್ಣೆ 5 ಮಿಲಿ ಪ್ರತಿ ಲೀಟರ್ ನೀರಿಗೆ ಬೆರೆಸಿ ಸಿಂಪಡಿಸಿ"
  ],
  "prevention_measures": [
    "ಸಸ್ಯಗಳ ನಡುವೆ ಸರಿಯಾದ ಅಂತರ ಕಾಯ್ದುಕೊಳ್ಳಿ"
  ],
  "needs_retake": false
}

=== STRICT RULES ===

RULE 1 — CONFIDENCE HONESTY (MOST IMPORTANT):
- Set confidence_pct > 65 ONLY if you clearly see specific disease symptoms on a plant
- Set confidence_pct 40-64 if you see a plant but symptoms are mild or ambiguous
- If confidence_pct < 40, you MUST set needs_retake=true
- NEVER guess a disease when you cannot clearly see symptoms
- Do NOT default to any single disease (especially NOT Powdery Mildew / ಕಣಕಾಲು ರೋಗ) unless you can see white powder on leaves

RULE 2 — LANGUAGE:
- ALL values must be in KANNADA (ಕನ್ನಡ) script
- plant_health_status must be exactly one of: "ಆರೋಗ್ಯಕರ" OR "ರೋಗಗ್ರಸ್ತ" OR "ಅಸ್ಪಷ್ಟ"
- disease_name may be an English scientific name, but disease_name_kn MUST be in Kannada

RULE 3 — ORGANIC TREATMENTS ONLY:
- Only suggest organic inputs: ಜೀವಾಮೃತ, ಬೇವಿನ ಎಣ್ಣೆ, ಪಂಚಗವ್ಯ, ಟ್ರೈಕೋಡರ್ಮಾ, ಬೀಜಾಮೃತ
- NEVER suggest: urea, DAP, NPK, chlorpyrifos, glyphosate, or any chemical pesticide

RULE 4 — BLURRY OR DARK IMAGES:
- If the image is too blurry, too dark, or out of focus to diagnose: needs_retake=true, confidence_pct=0

RULE 5 — HEALTHY PLANTS:
- If plant is visibly healthy with no disease symptoms: plant_health_status="ಆರೋಗ್ಯಕರ", disease_name_kn="ಆರೋಗ್ಯಕರ ಸಸ್ಯ"

Reply ONLY with valid JSON. No markdown fences. No extra text before or after."""


def _cache_key(b64: str, text: str = '') -> str:
    # Use the full base64 payload to avoid accidental collisions when images share prefixes.
    # Include optional text and mime to ensure uniqueness across requests.
    return hashlib.md5((b64 + text).encode()).hexdigest()


def _compress_image(b64: str, mime: str) -> tuple[str, str]:
    """
    If image base64 is > 300KB, resize to max 1024x1024 and re-encode at quality 60.
    Returns (new_b64, new_mime). Falls back to original if PIL not available.
    """
    SIZE_LIMIT = 300_000  # 300KB base64 chars
    if len(b64) <= SIZE_LIMIT or not HAS_PIL:
        return b64, mime

    try:
        img_bytes = base64.b64decode(b64)
        img = PILImage.open(io.BytesIO(img_bytes)).convert('RGB')
        # Resize to fit within 1024x1024
        img.thumbnail((1024, 1024), PILImage.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=60, optimize=True)
        new_b64 = base64.b64encode(buf.getvalue()).decode()
        print(f'[M4] Compressed image: {len(b64)} -> {len(new_b64)} chars')
        return new_b64, 'image/jpeg'
    except Exception as e:
        print(f'[M4] Compression failed (using original): {e}')
        return b64, mime


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
        sources=[source, 'ICAR Crop Protection Guidelines', 'Palekar ZBNF'],
        is_reliable=conf >= 45 and bool(data.get('disease_name')) and not data.get('needs_retake', False),
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
    if confidence < 70:
        return True

    disease_blob = f"{finding.disease_name or ''} {finding.disease_name_kn or ''}".lower()
    symptoms_blob = ' '.join(finding.visual_symptoms or []).lower()

    if any(term in disease_blob for term in POWDERY_MILDEW_TERMS):
        if not any(term in symptoms_blob for term in ['white', 'powder', 'fuzzy', 'fungal', 'fungus', 'mycelium']):
            return True

    if not _looks_like_plant_context(finding):
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

    # Compress large images before sending
    b64, mime = _compress_image(b64, mime)
    print(f'[M4] Sending to Gemini Flash: {len(b64)} chars, mime={mime}')

    url = GEMINI_URL_TEMPLATE.format(key=key)

    payload = {
        'contents': [{
            'parts': [
                {
                    'inline_data': {
                        'mime_type': mime,
                        'data': b64,
                    }
                },
                {
                    'text': prompt,
                },
            ]
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

    # Compress large images before sending
    b64, mime = _compress_image(b64, mime)
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
