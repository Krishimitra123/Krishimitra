"""
Module M4 — Crop Diagnosis
Primary: Gemini 2.0 Flash Vision (REST API, 45s timeout)
Fallback: Mistral Pixtral-12b (if Gemini 429/fails)
Cache: MD5 hash of image prevents repeat API calls for same photo.
"""

import httpx
import json
import os
import re
import hashlib
from models.schemas import DiagnosisRequest, DiagnosisFinding

# ── Simple in-memory cache (session-level) ───────────────────────
_diagnosis_cache: dict[str, DiagnosisFinding] = {}


def _cache_key(image_b64: str, optional_text: str = '') -> str:
    content = image_b64[:300] + (optional_text or '')
    return hashlib.md5(content.encode()).hexdigest()


# ── Gemini REST endpoint ─────────────────────────────────────────
GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite']

# ── Mistral Pixtral (fallback) ────────────────────────────────────
MISTRAL_BASE = 'https://api.mistral.ai/v1/chat/completions'
PIXTRAL_MODEL = 'pixtral-12b-2409'

# ── Diagnosis prompt ─────────────────────────────────────────────
DIAGNOSIS_PROMPT = """You are an expert crop pathologist for Indian organic farming.
Analyse this crop image carefully.

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "plant_health_status": "Healthy",
  "disease_name": "Healthy Plant",
  "disease_name_kn": "ಆರೋಗ್ಯಕರ ಸಸ್ಯ",
  "confidence_pct": 85,
  "visual_symptoms": ["description of what you see"],
  "probable_cause": "None",
  "organic_treatments": ["Continue Jeevamrutha application every 15 days"],
  "prevention_measures": ["Maintain soil organic matter"],
  "needs_retake": false
}

RULES:
- organic_treatments MUST NEVER include: urea, DAP, NPK, chemical pesticides
- Only organic inputs: Jeevamrutha, Beejamrutha, Neem extract, Panchagavya, Trichoderma
- If image is blurry/not a plant: set needs_retake=true, confidence_pct=0
- disease_name_kn MUST be in Kannada script"""

CHEMICAL_TERMS = [
    'urea', 'DAP', 'NPK', 'chlorpyrifos', 'imidacloprid',
    'cypermethrin', 'glyphosate', 'carbofuran', 'endosulfan',
    'ammonium sulphate', 'superphosphate',
]


def _fallback_finding(needs_retake: bool = True) -> DiagnosisFinding:
    return DiagnosisFinding(
        plant_health_status='Unclear',
        disease_name='Unable to identify',
        disease_name_kn='ಗುರುತಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ',
        confidence_pct=0,
        visual_symptoms=[],
        probable_cause='Unknown',
        organic_treatments=['ದಯವಿಟ್ಟು ಸ್ಥಳೀಯ KVK ಸಂಪರ್ಕಿಸಿ'],
        prevention_measures=[],
        needs_retake=needs_retake,
        sources=[],
        is_reliable=False,
    )


def _parse_json(raw: str) -> dict | None:
    cleaned = re.sub(r'```json\s*|```\s*', '', raw).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    start, end = cleaned.find('{'), cleaned.rfind('}')
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except json.JSONDecodeError:
            pass
    return None


def _build_finding(data: dict, source: str) -> DiagnosisFinding:
    safe_treatments = [
        t for t in data.get('organic_treatments', [])
        if not any(c.lower() in t.lower() for c in CHEMICAL_TERMS)
    ]
    confidence = max(0, min(100, int(data.get('confidence_pct', 0) or 0)))
    return DiagnosisFinding(
        plant_health_status=data.get('plant_health_status', 'Unclear'),
        disease_name=data.get('disease_name', 'Unknown'),
        disease_name_kn=data.get('disease_name_kn', ''),
        confidence_pct=float(confidence),
        visual_symptoms=data.get('visual_symptoms', []),
        probable_cause=data.get('probable_cause', 'Unknown'),
        organic_treatments=safe_treatments or ['ಸ್ಥಳೀಯ KVK ಸಲಹೆ ಪಡೆಯಿರಿ'],
        prevention_measures=data.get('prevention_measures', []),
        needs_retake=bool(data.get('needs_retake', False)),
        sources=[source, 'ICAR Crop Protection Guidelines'],
        is_reliable=confidence >= 55 and bool(data.get('disease_name')),
    )


async def _diagnose_gemini(image_b64: str, image_mime: str, prompt: str) -> DiagnosisFinding | None:
    """Try Gemini Vision REST API. Returns None on any failure."""
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not api_key:
        print('[M4-Gemini] API key missing')
        return None

    body = {
        'contents': [{'parts': [
            {'text': prompt},
            {'inline_data': {'mime_type': image_mime, 'data': image_b64}}
        ]}],
        'generationConfig': {'temperature': 0.1, 'maxOutputTokens': 1024}
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in GEMINI_MODELS:
            url = f'{GEMINI_BASE}/{model}:generateContent?key={api_key}'
            print(f'[M4-Gemini] Trying {model}...')
            try:
                resp = await client.post(url, json=body)
                if resp.status_code == 200:
                    parts = resp.json()['candidates'][0]['content']['parts']
                    text = parts[0].get('text', '').strip()
                    if text:
                        data = _parse_json(text)
                        if data:
                            print(f'[M4-Gemini] {model} success: {data.get("disease_name")}')
                            return _build_finding(data, f'Gemini {model}')
                elif resp.status_code == 429:
                    print(f'[M4-Gemini] {model} rate limited (429)')
                else:
                    print(f'[M4-Gemini] {model} HTTP {resp.status_code}')
            except httpx.TimeoutException:
                print(f'[M4-Gemini] {model} timed out')
            except Exception as e:
                print(f'[M4-Gemini] {model} error: {e}')
    return None


async def _diagnose_pixtral(image_b64: str, image_mime: str, prompt: str) -> DiagnosisFinding | None:
    """Try Mistral Pixtral Vision as fallback. Returns None on failure."""
    api_key = os.environ.get('MISTRAL_API_KEY', '').strip()
    if not api_key:
        print('[M4-Pixtral] API key missing')
        return None

    print(f'[M4-Pixtral] Trying {PIXTRAL_MODEL}...')

    body = {
        'model': PIXTRAL_MODEL,
        'messages': [{'role': 'user', 'content': [
            {'type': 'image_url', 'image_url': f'data:{image_mime};base64,{image_b64}'},
            {'type': 'text', 'text': prompt}
        ]}],
        'temperature': 0.1,
        'max_tokens': 1024,
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                MISTRAL_BASE,
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                },
                json=body
            )
        if resp.status_code == 200:
            text = resp.json()['choices'][0]['message']['content'].strip()
            data = _parse_json(text)
            if data:
                print(f'[M4-Pixtral] Success: {data.get("disease_name")}')
                return _build_finding(data, 'Pixtral-12b Vision')
            print(f'[M4-Pixtral] Could not parse JSON from: {text[:200]}')
        else:
            print(f'[M4-Pixtral] HTTP {resp.status_code}: {resp.text[:200]}')
    except httpx.TimeoutException:
        print('[M4-Pixtral] Timed out after 45s')
    except Exception as e:
        print(f'[M4-Pixtral] Error: {e}')
    return None


async def diagnose_image(request: DiagnosisRequest) -> DiagnosisFinding:
    """
    Main M4 entry point.
    1. Check cache — skip API if same image seen before
    2. Try Gemini 2.0 Flash (primary)
    3. Try Pixtral-12b (fallback)
    4. Return graceful fallback if both fail
    """
    if not request.image_base64 or len(request.image_base64) < 100:
        print('[M4] Image too short — rejecting')
        return _fallback_finding(needs_retake=True)

    # Check cache
    key = _cache_key(request.image_base64, request.optional_text or '')
    if key in _diagnosis_cache:
        print('[M4] Cache hit — returning cached result')
        return _diagnosis_cache[key]

    # Build contextual prompt
    prompt = DIAGNOSIS_PROMPT
    if request.optional_text:
        prompt += f'\n\nFarmer says: {request.optional_text}'
    if request.user_context:
        if request.user_context.primary_crop:
            prompt += f'\nCrop: {request.user_context.primary_crop}'
        if request.user_context.district:
            prompt += f'\nLocation: {request.user_context.district}, Karnataka'

    print(f'[M4] Starting diagnosis — image: {len(request.image_base64)} chars, mime: {request.image_mime}')

    # Try Gemini first
    finding = await _diagnose_gemini(request.image_base64, request.image_mime, prompt)

    # Try Pixtral if Gemini failed
    if finding is None:
        print('[M4] Gemini failed — trying Pixtral fallback...')
        finding = await _diagnose_pixtral(request.image_base64, request.image_mime, prompt)

    # Both failed
    if finding is None:
        print('[M4] Both Gemini and Pixtral failed — returning fallback')
        return _fallback_finding(needs_retake=True)

    # Cache successful result
    _diagnosis_cache[key] = finding
    print(f'[M4] Done: {finding.disease_name} ({finding.confidence_pct}%), reliable={finding.is_reliable}')
    return finding
