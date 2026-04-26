"""
Query Router — The main orchestrator: M1 → M2 → M3 → M5
Handles: voice-only, text-only, voice+image, text+image.

POST /api/query — Single unified endpoint for all farmer queries.
"""

from fastapi import APIRouter
from models.schemas import QueryRequest, QueryResponse, DiagnosisRequest
from modules import m1_voice, m2_nlp, m3_rag, m4_diagnosis, m5_response
import os

router = APIRouter(prefix='/api/query', tags=['query'])


@router.post('', response_model=QueryResponse)
async def query_endpoint(request: QueryRequest):
    """
    POST /api/query
    
    The single unified endpoint for all farmer queries.
    Handles: voice-only, text-only, voice+image, text+image.
    
    Flow: STT (if audio) → NLP → Route → RAG/Diagnosis → Response → TTS
    """
    transcript = None

    # ── Step 1: STT if audio provided ────────────────────────
    if request.audio_base64:
        try:
            stt_result = await m1_voice.audio_to_transcript(
                request.audio_base64, os.environ['SARVAM_API_KEY']
            )
            transcript = stt_result['transcript']
        except Exception as e:
            # STT failed — use text fallback if available
            if not request.text_query:
                return QueryResponse(
                    answer_text_kn='ಧ್ವನಿ ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ.',
                    error=str(e),
                )

    query_text = transcript or request.text_query or ''

    if not query_text and not request.image_base64:
        return QueryResponse(answer_text_kn='ದಯವಿಟ್ಟು ಪ್ರಶ್ನೆ ಕೇಳಿ.')

    # ── Step 2: NLP Processing ───────────────────────────────
    nlp_result = await m2_nlp.process(
        transcript=query_text,
        user_ctx=request.user_context,
        has_image=bool(request.image_base64),
    )

    # ── Step 3: Route ────────────────────────────────────────
    rag_chunks = []
    diagnosis_finding = None

    if 'rag' in nlp_result.routing:
        rag_chunks = await m3_rag.retrieve(nlp_result)

    if 'diagnosis' in nlp_result.routing and request.image_base64:
        diag_req = DiagnosisRequest(
            image_base64=request.image_base64,
            image_mime=request.image_mime,
            optional_text=query_text,
            user_context=request.user_context,
        )
        diagnosis_finding = await m4_diagnosis.diagnose_image(diag_req)

    # ── Step 4: Generate Response ────────────────────────────
    if diagnosis_finding:
        answer_kn = await m5_response.finding_to_kannada_text(
            diagnosis_finding, request.user_context
        )
        sources = diagnosis_finding.sources
    else:
        answer_kn, sources = await m5_response.generate(
            nlp_result, rag_chunks, request.user_context.farmer_name
        )

    # ── Step 5: TTS ──────────────────────────────────────────
    audio_b64 = None
    try:
        audio_b64 = await m1_voice.text_to_audio(
            answer_kn, os.environ['SARVAM_API_KEY']
        )
    except Exception:
        pass  # Non-fatal: text response still returned

    return QueryResponse(
        transcript=transcript,
        answer_text_kn=answer_kn,
        audio_base64=audio_b64,
        sources=sources,
        intent=nlp_result.intent.value,
        diagnosis=diagnosis_finding.model_dump() if diagnosis_finding else None,
        is_kvk_redirect=not rag_chunks and not diagnosis_finding,
    )
