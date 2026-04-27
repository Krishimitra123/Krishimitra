"""
Query Router — wires NLP → M5 (Mistral) → TTS (Sarvam)
Voice pipeline: STT → NLP intent gate → M5 Kannada answer → TTS audio
Text pipeline:  text → NLP intent gate → M5 Kannada answer → TTS audio
"""

from fastapi import APIRouter
from models.schemas import QueryRequest, QueryResponse, Intent
from modules import m1_voice, m2_nlp, m5_response
import os

router = APIRouter(prefix='/api/query', tags=['query'])


@router.post('', response_model=QueryResponse)
async def query_endpoint(request: QueryRequest):
    transcript = None

    # ── Step 1: STT — convert audio to text ──────────────────────
    if request.audio_base64:
        try:
            audio_mime = request.audio_mime or 'audio/mp4'
            stt_res = await m1_voice.audio_to_transcript(
                request.audio_base64,
                os.environ.get('SARVAM_API_KEY', ''),
                mime_type=audio_mime
            )
            transcript = (stt_res.get('transcript') or '').strip()
            print(f'[Query] STT transcript: "{transcript}"')

            # Empty transcript = silence / noise / language mismatch
            if not transcript and not request.text_query:
                return QueryResponse(
                    answer_text_kn='ಧ್ವನಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟುಯಾವಾಗಲಾದರೂ ಮಾತನಾಡಿ ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.',
                    error='STT returned empty transcript'
                )
        except Exception as e:
            print(f'[Query] STT failed: {e}')
            if not request.text_query:
                return QueryResponse(
                    answer_text_kn='ಧ್ವನಿ ಗುರುತಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟುಟೈಪ್ ಮಾಡಿ.',
                    error=str(e)
                )

    query_text = transcript or request.text_query or ''
    if not query_text:
        return QueryResponse(answer_text_kn='ದಯವಿಟ್ಟು ಪ್ರಶ್ನೆ ಕೇಳಿ.')

    # ── Step 2: NLP — classify intent and extract entities ────────
    nlp_result = m2_nlp.process(
        transcript=query_text,
        user_ctx=request.user_context,
        has_image=bool(request.image_base64)
    )
    print(f'[Query] Intent: {nlp_result.intent}, Entities: {nlp_result.entities}')

    # ── Step 3: M5 — generate Kannada answer via Mistral ─────────
    farmer_name = 'ರೈತರೇ'
    if request.user_context and request.user_context.farmer_name:
        farmer_name = request.user_context.farmer_name

    answer, sources = await m5_response.generate(
        nlp_result=nlp_result,
        farmer_name=farmer_name,
    )
    print(f'[Query] Answer ({len(answer)} chars): {answer[:80]}...')

    # ── Step 4: TTS — convert Kannada text to audio ───────────────
    audio_output = None
    try:
        audio_output = await m1_voice.text_to_audio(
            answer, os.environ.get('SARVAM_API_KEY', '')
        )
    except Exception as e:
        print(f'[Query] TTS failed (non-fatal): {e}')

    return QueryResponse(
        transcript=query_text,
        answer_text_kn=answer,
        audio_base64=audio_output,
        intent=nlp_result.intent,
        sources=sources,
    )
