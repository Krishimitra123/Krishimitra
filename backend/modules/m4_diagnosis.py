"""
Module M4 — Crop Diagnosis (Pixtral-12b direct)
Key fix: image_url must be {"url": "data:..."} not a bare string.
Hard 35s overall asyncio timeout. Image result cached by MD5.
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

CHEMICAL_TERMS = [
    'urea', 'DAP', 'NPK', 'chlorpyrifos', 'imidacloprid',
    'cypermethrin', 'glyphosate', 'endosulfan', 'ammonium sulphate',
]

DIAGNOSIS_PROMPT = """You are an expert Indian crop pathologist for organic farming in Karnataka.
Analyze this plant/crop image carefully for any disease, pest, or health issue.

CRITICAL: ALL text values in the JSON MUST be written in KANNADA (ಕನ್ನಡ) script. 
The JSON field names stay in English, but ALL VALUES must be in Kannada.

Reply ONLY with valid JSON (no markdown fences, no extra text):
{
  "plant_health_status": "ರೋಗಗ್ರಸ್ತ",
  "disease_name": "Powdery Mildew",
  "disease_name_kn": "ಕಣಕಾಲು ರೋಗ",
  "confidence_pct": 80,
  "visual_symptoms": ["ಎಲೆಗಳ ಮೇಲೆ ಬಿಳಿ ಪುಡಿ ಕಂಡುಬರುತ್ತಿದೆ", "ಎಲೆಗಳು ಹಳದಿ ಬಣ್ಣಕ್ಕೆ ತಿರುಗುತ್ತಿವೆ"],
  "probable_cause": "ಅಧಿಕ ತೇವಾಂಶ ಮತ್ತು ಕಳಪೆ ಗಾಳಿ ಸಂಚಾರದಿಂದ ಶಿಲೀಂಧ್ರ ಸೋಂಕು",
  "organic_treatments": [
    "ಪ್ರತಿ 10 ದಿನಕ್ಕೊಮ್ಮೆ ಪಂಚಗವ್ಯ 3% ದ್ರಾವಣ ಸಿಂಪಡಿಸಿ",
    "ಬೇವಿನ ಎಣ್ಣೆ 5 ಮಿಲಿ ಪ್ರತಿ ಲೀಟರ್ ನೀರಿಗೆ ಬೆರೆಸಿ ಸಿಂಪಡಿಸಿ",
    "ಟ್ರೈಕೋಡರ್ಮಾ ವಿರಿಡೆ ಮಣ್ಣಿಗೆ ಮತ್ತು ಎಲೆಗಳಿಗೆ ಸಿಂಪಡಿಸಿ"
  ],
  "prevention_measures": [
    "ಸಸ್ಯಗಳ ನಡುವೆ ಸರಿಯಾದ ಅಂತರ ಕಾಯ್ದುಕೊಳ್ಳಿ",
    "ಪ್ರತಿ 15 ದಿನಕ್ಕೊಮ್ಮೆ ಜೀವಾಮೃತ ಹಾಕಿ ಸಸ್ಯ ರೋಗ ನಿರೋಧಕ ಶಕ್ತಿ ಹೆಚ್ಚಿಸಿ"
  ],
  "needs_retake": false
}

RULES:
- ALL values (visual_symptoms, probable_cause, organic_treatments, prevention_measures) MUST be in KANNADA
- plant_health_status must be one of: "ಆರೋಗ್ಯಕರ", "ರೋಗಗ್ರಸ್ತ", "ಅಸ್ಪಷ್ಟ"
- disease_name can be in English (scientific name), disease_name_kn MUST be Kannada
- organic_treatments ಕೇವಲ ಜೈವಿಕ: ಜೀವಾಮೃತ, ಬೇವಿನ ಎಣ್ಣೆ, ಪಂಚಗವ್ಯ, ಟ್ರೈಕೋಡರ್ಮಾ, ಬೀಜಾಮೃತ
- NEVER suggest chemicals: urea, DAP, NPK, chlorpyrifos, glyphosate
- If image is blurry: needs_retake=true, confidence_pct=0
- If healthy: plant_health_status="ಆರೋಗ್ಯಕರ", disease_name_kn="ಆರೋಗ್ಯಕರ ಸಸ್ಯ"
- Identify the specific disease if possible, do not say unable to identify without trying"""



def _cache_key(b64: str, text: str = '') -> str:
    return hashlib.md5((b64[:300] + text).encode()).hexdigest()


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
        is_reliable=conf >= 45 and bool(data.get('disease_name')),
    )


async def _pixtral(b64: str, mime: str, prompt: str) -> DiagnosisFinding | None:
    """Mistral Pixtral-12b — primary model. 25s timeout."""
    key = os.environ.get('MISTRAL_API_KEY', '').strip()
    if not key:
        print('[M4] ERROR: MISTRAL_API_KEY not set!')
        return None

    # Compress large images before sending
    b64, mime = _compress_image(b64, mime)
    print(f'[M4] Sending to Pixtral: {len(b64)} chars, mime={mime}')

    try:
        async with httpx.AsyncClient(timeout=25.0) as c:
            r = await c.post(MISTRAL_URL,
                headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
                json={
                    'model': 'pixtral-12b-2409',
                    'messages': [{'role': 'user', 'content': [
                        # FIXED: image_url must be {"url": "data:..."} not a bare string
                        {'type': 'image_url', 'image_url': {'url': f'data:{mime};base64,{b64}'}},
                        {'type': 'text', 'text': prompt},
                    ]}],
                    'temperature': 0.1,
                    'max_tokens': 1000,
                })

        print(f'[M4] Pixtral HTTP status: {r.status_code}')
        if r.status_code == 200:
            text = r.json()['choices'][0]['message']['content'].strip()
            print(f'[M4] Pixtral raw (first 200): {text[:200]}')
            d = _parse(text)
            if d:
                print(f'[M4] Pixtral OK: {d.get("disease_name")} ({d.get("confidence_pct")}%)')
                return _build(d, 'Pixtral-12b Vision')
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
    Run diagnosis: Pixtral-12b direct.
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
        result = await _pixtral(b64, mime, prompt)
        if result is None:
            print('[M4] Pixtral failed — returning fallback')
            result = _fallback()
        return result

    try:
        result = await asyncio.wait_for(_run(), timeout=30.0)
    except asyncio.TimeoutError:
        print('[M4] 30s hard timeout hit')
        result = _fallback()

    if result.is_reliable:
        _cache[ck] = result

    return result
