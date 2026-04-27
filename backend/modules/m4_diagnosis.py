"""
Module M4 — Crop Diagnosis
Primary: Mistral Pixtral-12b (fast, no quota issues)
Fallback: Gemini REST (if Pixtral fails)
Hard 35s overall timeout via asyncio prevents the 120s mobile hang.
Image caching prevents duplicate API calls.
"""

import httpx
import json
import os
import re
import asyncio
import hashlib
from models.schemas import DiagnosisRequest, DiagnosisFinding

# ── In-memory result cache ────────────────────────────────────────
_cache: dict[str, DiagnosisFinding] = {}


def _cache_key(b64: str, text: str = '') -> str:
    return hashlib.md5((b64[:300] + text).encode()).hexdigest()


# ── API endpoints ─────────────────────────────────────────────────
MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'
GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

CHEMICAL_TERMS = [
    'urea', 'DAP', 'NPK', 'chlorpyrifos', 'imidacloprid',
    'cypermethrin', 'glyphosate', 'endosulfan', 'ammonium sulphate',
]

DIAGNOSIS_PROMPT = """You are a crop pathologist for Indian organic farming.
Analyse this crop image carefully.

Reply ONLY with valid JSON (no markdown fences, no extra text):
{
  "plant_health_status": "Healthy",
  "disease_name": "Healthy Plant",
  "disease_name_kn": "ಆರೋಗ್ಯಕರ ಸಸ್ಯ",
  "confidence_pct": 85,
  "visual_symptoms": ["Green leaves, no spots visible"],
  "probable_cause": "None",
  "organic_treatments": ["Continue Jeevamrutha application every 15 days"],
  "prevention_measures": ["Maintain soil organic matter"],
  "needs_retake": false
}

STRICT RULES:
- organic_treatments MUST NEVER include: urea, DAP, NPK, any chemical pesticides
- Only organic: Jeevamrutha, Neem extract, Panchagavya, Trichoderma, Beejamrutha
- If image is blurry or not a plant: set needs_retake=true, confidence_pct=0
- disease_name_kn MUST be written in Kannada script"""


def _fallback(needs_retake: bool = True) -> DiagnosisFinding:
    return DiagnosisFinding(
        plant_health_status='Unclear',
        disease_name='Unable to identify',
        disease_name_kn='ಗುರುತಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ',
        confidence_pct=0.0,
        visual_symptoms=[],
        probable_cause='Unknown',
        organic_treatments=['ದಯವಿಟ್ಟು ಸ್ಥಳೀಯ KVK ಸಂಪರ್ಕಿಸಿ'],
        prevention_measures=[],
        needs_retake=needs_retake,
        sources=[],
        is_reliable=False,
    )


def _parse(raw: str) -> dict | None:
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
        probable_cause=data.get('probable_cause', 'Unknown'),
        organic_treatments=safe or ['ಸ್ಥಳೀಯ KVK ಸಲಹೆ ಪಡೆಯಿರಿ'],
        prevention_measures=data.get('prevention_measures', []),
        needs_retake=bool(data.get('needs_retake', False)),
        sources=[source, 'ICAR Crop Protection Guidelines'],
        is_reliable=conf >= 55 and bool(data.get('disease_name')),
    )


async def _pixtral(b64: str, mime: str, prompt: str) -> DiagnosisFinding | None:
    """Mistral Pixtral — primary model. 25s timeout."""
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
                        {'type': 'image_url', 'image_url': f'data:{mime};base64,{b64}'},
                        {'type': 'text', 'text': prompt},
                    ]}],
                    'temperature': 0.1,
                    'max_tokens': 800,
                })
        if r.status_code == 200:
            text = r.json()['choices'][0]['message']['content'].strip()
            d = _parse(text)
            if d:
                print(f'[M4] Pixtral OK: {d.get("disease_name")} ({d.get("confidence_pct")}%)')
                return _build(d, 'Pixtral-12b Vision')
            print(f'[M4] Pixtral bad JSON: {text[:100]}')
        else:
            print(f'[M4] Pixtral HTTP {r.status_code}: {r.text[:150]}')
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

    async with httpx.AsyncClient(timeout=15.0) as c:
        for model in ['gemini-2.0-flash', 'gemini-2.0-flash-lite']:
            print(f'[M4] Trying Gemini {model}...')
            try:
                r = await c.post(
                    f'{GEMINI_BASE}/{model}:generateContent?key={api_key}',
                    json=body)
                if r.status_code == 200:
                    parts = r.json()['candidates'][0]['content']['parts']
                    text = parts[0].get('text', '').strip()
                    d = _parse(text)
                    if d:
                        print(f'[M4] Gemini {model} OK: {d.get("disease_name")}')
                        return _build(d, f'Gemini {model}')
                elif r.status_code == 429:
                    print(f'[M4] Gemini {model} rate limited — skipping')
                else:
                    print(f'[M4] Gemini {model} HTTP {r.status_code}')
            except httpx.TimeoutException:
                print(f'[M4] Gemini {model} timed out')
            except Exception as e:
                print(f'[M4] Gemini {model} error: {e}')
    return None


async def diagnose_image(request: DiagnosisRequest) -> DiagnosisFinding:
    """
    Main M4 entry point.
    Overall 50s hard limit via asyncio.wait_for — backend ALWAYS responds
    before the mobile's 120s axios timeout.
    Order: Pixtral (25s) → Gemini (15s each) → graceful fallback.
    """
    if not request.image_base64 or len(request.image_base64) < 200:
        return _fallback(needs_retake=True)

    # Cache check
    ck = _cache_key(request.image_base64, request.optional_text or '')
    if ck in _cache:
        print('[M4] Cache hit')
        return _cache[ck]

    # Build prompt with context
    prompt = DIAGNOSIS_PROMPT
    if request.optional_text:
        prompt += f'\nFarmer note: {request.optional_text}'
    if request.user_context:
        if request.user_context.primary_crop:
            prompt += f'\nCrop: {request.user_context.primary_crop}'
        if request.user_context.district:
            prompt += f'\nLocation: {request.user_context.district}, Karnataka'

    print(f'[M4] Image {len(request.image_base64)} chars, mime: {request.image_mime}')

    async def _run() -> DiagnosisFinding:
        # Try Pixtral first (primary — no quota issues)
        result = await _pixtral(request.image_base64, request.image_mime, prompt)
        if result:
            return result
        # Fall back to Gemini
        print('[M4] Pixtral failed — trying Gemini...')
        result = await _gemini(request.image_base64, request.image_mime, prompt)
        if result:
            return result
        print('[M4] All models failed — returning fallback')
        return _fallback(needs_retake=True)

    try:
        # Hard 50s cap — mobile client has 120s timeout, this guarantees a response
        finding = await asyncio.wait_for(_run(), timeout=50.0)
    except asyncio.TimeoutError:
        print('[M4] Overall 50s timeout reached — returning fallback')
        finding = _fallback(needs_retake=True)

    _cache[ck] = finding
    return finding
