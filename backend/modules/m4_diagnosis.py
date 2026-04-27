"""
Module M4 — Crop Diagnosis (Pixtral primary, Gemini fallback)
Key fix: image_url must be {"url": "data:..."} not a bare string.
Hard 35s overall asyncio timeout. Image result cached by MD5.
"""

import asyncio
import hashlib
import httpx
import json
import os
import re
from models.schemas import DiagnosisRequest, DiagnosisFinding

_cache: dict[str, DiagnosisFinding] = {}

MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'
GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

CHEMICAL_TERMS = [
    'urea', 'DAP', 'NPK', 'chlorpyrifos', 'imidacloprid',
    'cypermethrin', 'glyphosate', 'endosulfan', 'ammonium sulphate',
]

DIAGNOSIS_PROMPT = """You are an expert Indian crop pathologist specializing in organic farming.
Analyze this plant/crop image carefully and identify any disease, pest damage, or health issues.

IMPORTANT: Analyze whatever plant is visible in the image — do not require a specific crop.

Reply ONLY with valid JSON (no markdown fences, no extra text):
{
  "plant_health_status": "Diseased",
  "disease_name": "Leaf Blight",
  "disease_name_kn": "ಎಲೆ ರೋಗ",
  "confidence_pct": 80,
  "visual_symptoms": ["Yellow spots on leaves", "Brown edges"],
  "probable_cause": "Fungal infection due to excess moisture",
  "organic_treatments": [
    "Spray Panchagavya 3% solution every 10 days",
    "Apply Neem oil 5ml per litre water",
    "Use Trichoderma viride as soil drench"
  ],
  "prevention_measures": [
    "Maintain proper spacing for air circulation",
    "Apply Jeevamrutha every 15 days to strengthen plant immunity"
  ],
  "needs_retake": false
}

RULES:
- organic_treatments MUST NEVER include chemicals: urea, DAP, NPK, chlorpyrifos
- Only use: Jeevamrutha, Neem, Panchagavya, Trichoderma, Beejamrutha, Gau Krupa Amrutha
- disease_name_kn MUST be in Kannada script
- If the image is too blurry to analyze: needs_retake=true, confidence_pct=0
- If it is a healthy plant: disease_name="Healthy Plant", disease_name_kn="ಆರೋಗ್ಯಕರ ಸಸ್ಯ"
- Be specific about what you see, do not say "unable to identify" without trying"""


def _cache_key(b64: str, text: str = '') -> str:
    return hashlib.md5((b64[:300] + text).encode()).hexdigest()


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
        return None

    print('[M4] Trying Pixtral-12b...')
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
                    'max_tokens': 800,
                })

        if r.status_code == 200:
            text = r.json()['choices'][0]['message']['content'].strip()
            print(f'[M4] Pixtral raw: {text[:120]}')
            d = _parse(text)
            if d:
                print(f'[M4] Pixtral OK: {d.get("disease_name")} ({d.get("confidence_pct")}%)')
                return _build(d, 'Pixtral-12b Vision')
            print(f'[M4] Pixtral JSON parse failed: {text[:200]}')
        else:
            print(f'[M4] Pixtral HTTP {r.status_code}: {r.text[:200]}')

    except httpx.TimeoutException:
        print('[M4] Pixtral timed out after 25s')
    except Exception as e:
        print(f'[M4] Pixtral error: {e}')
    return None


async def _gemini(b64: str, mime: str, prompt: str) -> DiagnosisFinding | None:
    """Gemini Vision — fallback if Pixtral fails. 15s timeout per model."""
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not api_key:
        return None

    body = {
        'contents': [{'parts': [
            {'text': prompt},
            {'inline_data': {'mime_type': mime, 'data': b64}},
        ]}],
        'generationConfig': {'temperature': 0.1, 'maxOutputTokens': 800},
    }

    for model in ['gemini-2.0-flash', 'gemini-2.0-flash-lite']:
        print(f'[M4] Trying Gemini {model}...')
        try:
            async with httpx.AsyncClient(timeout=15.0) as c:
                r = await c.post(
                    f'{GEMINI_BASE}/{model}:generateContent?key={api_key}',
                    json=body)

            if r.status_code == 200:
                parts = r.json()['candidates'][0]['content']['parts']
                text = parts[0].get('text', '').strip()
                print(f'[M4] Gemini {model} raw: {text[:120]}')
                d = _parse(text)
                if d:
                    print(f'[M4] Gemini OK: {d.get("disease_name")} ({d.get("confidence_pct")}%)')
                    return _build(d, f'Gemini {model}')
            else:
                print(f'[M4] Gemini {model} HTTP {r.status_code}: {r.text[:100]}')

        except httpx.TimeoutException:
            print(f'[M4] Gemini {model} timed out')
        except Exception as e:
            print(f'[M4] Gemini {model} error: {e}')

    return None


async def diagnose(request: DiagnosisRequest) -> DiagnosisFinding:
    """
    Run diagnosis: Pixtral → Gemini fallback → static fallback.
    Hard 35s overall timeout.
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
            result = await _gemini(b64, mime, prompt)
        if result is None:
            print('[M4] Both models failed — returning fallback')
            result = _fallback()
        return result

    try:
        result = await asyncio.wait_for(_run(), timeout=35.0)
    except asyncio.TimeoutError:
        print('[M4] 35s hard timeout hit')
        result = _fallback()

    if result.is_reliable:
        _cache[ck] = result

    return result
