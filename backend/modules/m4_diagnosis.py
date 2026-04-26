"""
Module M4 — Crop Diagnosis
Responsibility: Accept crop image (base64) → Gemini 2.0 Flash Vision → parse response →
extract disease name, confidence, visual symptoms, organic-only treatment.
Cross-reference treatment with M3 RAG for validation.

CRITICAL: organic_treatments must NEVER include chemical pesticides or synthetic fertilisers.
"""

import google.generativeai as genai
import json
import os
import re
import base64
import asyncio
import traceback
from models.schemas import (
    DiagnosisRequest, DiagnosisFinding, NLPResult, Intent, UserContext
)

genai.configure(api_key=os.environ.get('GEMINI_API_KEY', ''), transport='rest')


def _build_model_candidates() -> list[str]:
    configured = os.environ.get('GEMINI_DIAGNOSIS_MODELS', '').strip()
    if configured:
        models = [m.strip() for m in configured.split(',') if m.strip()]
    else:
        primary = os.environ.get('GEMINI_DIAGNOSIS_MODEL', 'gemini-2.5-flash').strip()
        models = [primary, 'gemini-2.0-flash', 'gemini-2.0-flash-lite']

    unique: list[str] = []
    seen = set()
    for model_name in models:
        key = model_name.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(model_name)
    return unique


_MODEL_CANDIDATES = _build_model_candidates()


# ── Strict Diagnosis Prompt ──────────────────────────────────────

DIAGNOSIS_SYSTEM_PROMPT = '''
You are an expert crop pathologist specialising in Indian organic farming.
You will be given a photo of a crop leaf, stem, or fruit.
Your task:
1. Is the plant healthy or diseased? State "Healthy" or "Diseased".
2. Identify the disease, pest, or nutrient deficiency visible in the image. If Healthy, state "Healthy".
3. State your confidence as a percentage (0-100).
4. List ONLY organic treatments (no chemical pesticides, no synthetic fertilisers). If healthy, provide general care tips.
5. If the image is not a crop or is too blurry, set needs_retake=true.

Respond ONLY in this JSON format, no other text:
{
  "plant_health_status": "Healthy | Diseased | Unclear",
  "disease_name": "string (English)",
  "disease_name_kn": "string (Kannada)",
  "confidence_pct": number,
  "visual_symptoms": ["list of observed symptoms"],
  "probable_cause": "Fungal | Bacterial | Viral | Nutrient Deficiency | Pest | None",
  "organic_treatments": ["treatment 1", "treatment 2"],
  "prevention_measures": ["prevention 1"],
  "needs_retake": false
}
CRITICAL: organic_treatments must never include urea, DAP, NPK fertilisers,
or chemical pesticides. Only organic inputs allowed.
'''

# ── Chemical safety filter terms ─────────────────────────────────

CHEMICAL_TERMS = [
    'urea', 'DAP', 'NPK', 'MOP', 'chlorpyrifos', 'imidacloprid',
    'cypermethrin', 'glyphosate', 'carbofuran', 'endosulfan',
    'monocrotophos', 'ammonium sulphate',
]


def _parse_diagnosis_json(raw_text: str) -> dict | None:
    """Parse Gemini response that may include markdown fences or extra prose."""
    cleaned = re.sub(r'```json\s*|```\s*', '', raw_text).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    start = cleaned.find('{')
    end = cleaned.rfind('}')
    if start == -1 or end == -1 or end <= start:
        return None

    snippet = cleaned[start:end + 1]
    try:
        return json.loads(snippet)
    except json.JSONDecodeError:
        return None

def _is_quota_error(error: Exception) -> bool:
    message = str(error).lower()
    return any(t in message for t in ['resourceexhausted', 'quota', '429'])


def _is_retryable_model_error(error: Exception) -> bool:
    message = str(error).lower()
    return any(token in message for token in [
        'deadline', 'timeout', 'unavailable', 'internal', '503', 'overloaded',
    ])


async def _generate_diagnosis_with_fallback(contents: list, generation_config: dict):
    """Try each model candidate. Skip immediately on quota errors, retry once on transient errors."""
    last_error: Exception | None = None

    for model_name in _MODEL_CANDIDATES:
        model = genai.GenerativeModel(model_name)
        try:
            print(f'[M4] Trying {model_name}...')
            response = await asyncio.to_thread(
                model.generate_content,
                contents,
                generation_config=generation_config,
            )
            text = ''
            try:
                text = response.text or ''
            except Exception:
                print(f'[M4] {model_name}: response blocked/empty')
                continue

            if text.strip():
                print(f'[M4] {model_name} SUCCESS: {text[:80]}...')
                return response
            print(f'[M4] {model_name}: empty response')
        except Exception as exc:
            err_str = str(exc)[:150]
            print(f'[M4] {model_name} FAILED: {err_str}')
            last_error = exc

            if _is_quota_error(exc):
                # Quota exhausted — skip to next model immediately
                print(f'[M4] Quota exhausted for {model_name}, trying next model...')
                continue

            if _is_retryable_model_error(exc):
                # Transient error — one retry after 2s
                await asyncio.sleep(2)
                try:
                    print(f'[M4] Retrying {model_name}...')
                    response = await asyncio.to_thread(
                        model.generate_content,
                        contents,
                        generation_config=generation_config,
                    )
                    text = (response.text or '').strip()
                    if text:
                        print(f'[M4] {model_name} retry SUCCESS')
                        return response
                except Exception as retry_exc:
                    print(f'[M4] {model_name} retry also failed')
                    last_error = retry_exc

    if last_error:
        raise last_error
    raise RuntimeError('Diagnosis generation failed with no model response.')


async def diagnose_image(request: DiagnosisRequest) -> DiagnosisFinding:
    """
    Main M4 entry point.
    
    1. Send image to Gemini Vision with strict organic-only prompt
    2. Parse JSON response
    3. Safety filter: strip chemical mentions
    4. Cross-validate treatments with RAG (M3)
    5. Return DiagnosisFinding
    """
    # ── Decode image ─────────────────────────────────────────
    try:
        image_bytes = base64.b64decode(request.image_base64)
        print(f'[M4] Image decoded: {len(image_bytes)} bytes, mime: {request.image_mime}')
    except Exception as e:
        print(f'[M4] Failed to decode image base64: {e}')
        raise ValueError(f'Invalid image data: {e}')

    # ── Build image part for google.generativeai SDK ─────────
    # SDK expects: {'mime_type': str, 'data': bytes}
    image_part = {
        'mime_type': request.image_mime,
        'data': image_bytes,
    }

    # ── Build prompt with farmer context ─────────────────────
    prompt_text = DIAGNOSIS_SYSTEM_PROMPT
    if request.optional_text:
        prompt_text += f'\nFarmer description: {request.optional_text}'
    if request.user_context and request.user_context.primary_crop:
        prompt_text += f'\nFarmer grows: {request.user_context.primary_crop}'
    if request.user_context and request.user_context.district:
        prompt_text += f'\nLocation: {request.user_context.district}, Karnataka'

    # ── Call Gemini Vision ───────────────────────────────────
    print(f'[M4] Sending image to Gemini Vision...')
    try:
        response = await _generate_diagnosis_with_fallback(
            contents=[prompt_text, image_part],
            generation_config={
                'temperature': 0.1,
                'max_output_tokens': 4096,
            },
        )
    except Exception as e:
        print(f'[M4] Gemini Vision call FAILED: {e}')
        traceback.print_exc()
        return DiagnosisFinding(
            plant_health_status='Unclear',
            disease_name='Unable to identify',
            disease_name_kn='ಗುರುತಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ',
            confidence_pct=0,
            visual_symptoms=[],
            probable_cause='Unknown',
            organic_treatments=['ದಯವಿಟ್ಟು ಸ್ಥಳೀಯ KVK ಸಂಪರ್ಕಿಸಿ'],
            prevention_measures=[],
            sources=[],
            is_reliable=False,
            needs_retake=False,
        )

    raw_text = (response.text or '').strip()
    print(f'[M4] Raw Gemini response: {raw_text[:300]}')

    data = _parse_diagnosis_json(raw_text)
    if not data:
        print(f'[M4] FAILED to parse JSON from: {raw_text[:500]}')
        return DiagnosisFinding(
            plant_health_status='Unclear',
            disease_name='Unable to identify',
            disease_name_kn='ಗುರುತಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ',
            confidence_pct=0,
            visual_symptoms=[],
            probable_cause='Unknown',
            organic_treatments=[],
            prevention_measures=[],
            sources=[],
            is_reliable=False,
            needs_retake=True,
        )

    print(f'[M4] Parsed diagnosis: {data.get("disease_name")} ({data.get("confidence_pct")}%)')

    # ── Safety filter: strip any chemical mentions ───────────
    safe_treatments = []
    for treatment in data.get('organic_treatments', []):
        if not any(chem.lower() in treatment.lower() for chem in CHEMICAL_TERMS):
            safe_treatments.append(treatment)

    confidence = max(0, min(100, int(data.get('confidence_pct', 0) or 0)))
    symptoms = data.get('visual_symptoms', [])
    needs_retake = bool(data.get('needs_retake', False))

    # ── Cross-reference with RAG for treatment validation ────
    rag_sources = []
    if data.get('disease_name') and confidence >= 50:
        try:
            from modules.m3_rag import retrieve as rag_retrieve

            mock_nlp = NLPResult(
                raw_transcript=data['disease_name'],
                normalised_query=data['disease_name'],
                detected_language='en',
                intent=Intent.PEST_DISEASE,
                confidence=0.9,
                entities={
                    'crop_name': request.user_context.primary_crop if request.user_context else None,
                    'district': request.user_context.district if request.user_context else None,
                    'symptom_keywords': data.get('visual_symptoms', []),
                    'season': None,
                    'preparation_name': None,
                },
                enriched_query=f"{data['disease_name']} organic treatment Karnataka",
            )

            rag_chunks = await rag_retrieve(mock_nlp)
            rag_sources = [chunk.citation() for chunk in rag_chunks[:3]]

            for chunk in rag_chunks[:2]:
                if 'organic' in chunk.content.lower() and len(safe_treatments) < 5:
                    safe_treatments.append(f'[Verified] {chunk.content[:200]}')
        except Exception as rag_err:
            print(f'[M4] RAG cross-reference failed (non-fatal): {rag_err}')

    result = DiagnosisFinding(
        plant_health_status = data.get('plant_health_status', 'Unclear'),
        disease_name        = data.get('disease_name', 'Unknown'),
        disease_name_kn     = data.get('disease_name_kn', ''),
        confidence_pct      = confidence,
        visual_symptoms     = symptoms,
        probable_cause      = data.get('probable_cause', 'Unknown'),
        organic_treatments  = safe_treatments,
        prevention_measures = data.get('prevention_measures', []),
        sources             = rag_sources,
        is_reliable         = confidence >= 50,
        needs_retake        = needs_retake,
    )
    print(f'[M4] Diagnosis complete: {result.disease_name} (reliable={result.is_reliable})')
    return result
