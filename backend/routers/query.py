"""
Query Router — STT → NLP → M5 (Mistral) → TTS (Sarvam)
Hard 45s asyncio timeout: backend ALWAYS responds before mobile's 60s axios limit.
TTS is non-fatal — if it fails, text answer is still returned.
"""

import asyncio
from fastapi import APIRouter
from models.schemas import QueryRequest, QueryResponse, Intent
from modules import m1_voice, m2_nlp, m3_rag, m5_response
import os

router = APIRouter(prefix='/api/query', tags=['query'])

SARVAM_KEY = lambda: os.environ.get('SARVAM_API_KEY', '')


async def _run_query(request: QueryRequest) -> QueryResponse:
    """Core query logic — extracted so we can wrap with asyncio.wait_for."""

    transcript: str | None = None

    # ── Step 1: STT — audio → text (15s timeout inside m1_voice) ────
    if request.audio_base64:
        try:
            mime = request.audio_mime or 'audio/mp4'
            result = await m1_voice.audio_to_transcript(
                request.audio_base64,
                SARVAM_KEY(),
                mime_type=mime,
            )
            transcript = (result.get('transcript') or '').strip()
            print(f'[Query] STT: "{transcript}"')

            # Sarvam returned silence / couldn't recognise speech
            if not transcript and not request.text_query:
                return QueryResponse(
                    answer_text_kn=(
                        'ಧ್ವನಿ ಕೇಳಿಸಲಿಲ್ಲ. ಮೈಕ್ ಹತ್ತಿರ ಹಿಡಿದು ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ.'
                    ),
                    error='empty_transcript',
                )

        except Exception as e:
            print(f'[Query] STT failed: {e}')
            if not request.text_query:
                return QueryResponse(
                    answer_text_kn='ಧ್ವನಿ ಗುರುತಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ.',
                    error=str(e),
                )

    query_text = transcript or request.text_query or ''
    if not query_text:
        return QueryResponse(answer_text_kn='ದಯವಿಟ್ಟು ಪ್ರಶ್ನೆ ಕೇಳಿ.')

    # ── Step 2: NLP — classify intent ────────────────────────────────
    nlp = m2_nlp.process(
        transcript=query_text,
        user_ctx=request.user_context,
        has_image=bool(request.image_base64),
    )
    print(f'[Query] Intent: {nlp.intent.value}, query: "{query_text[:50]}"')

    # ── Step 3: RAG — retrieve relevant chunks from Supabase ─────────
    rag_chunks = []
    try:
        rag_chunks = await m3_rag.retrieve(nlp)
        if rag_chunks:
            print(f'[Query] RAG: {len(rag_chunks)} chunks, top sim={rag_chunks[0].similarity:.3f}')
        else:
            print('[Query] RAG: no relevant chunks found')
    except Exception as e:
        print(f'[Query] RAG failed (non-fatal): {e}')

    # ── Step 4: M5 — Mistral Kannada answer with RAG context ─────────
    farmer_name = 'ರೈತರೇ'
    if request.user_context and request.user_context.farmer_name:
        farmer_name = request.user_context.farmer_name

    answer_task = asyncio.create_task(
        m5_response.generate(
            nlp_result=nlp,
            farmer_name=farmer_name,
            rag_chunks=rag_chunks,
            conversation_history=request.conversation_history,
        )
    )

    answer, sources = await answer_task
    print(f'[Query] Answer ({len(answer)} chars): {answer[:60]}...')

    # ── Step 4: TTS — text → audio (15s timeout, non-fatal) ──────────
    audio_b64: str | None = None
    try:
        tts_result = await m1_voice.text_to_audio(answer, SARVAM_KEY())
        if tts_result:
            audio_b64 = tts_result
    except Exception as e:
        print(f'[Query] TTS failed (non-fatal): {e}')

    return QueryResponse(
        transcript=query_text,
        answer_text_kn=answer,
        audio_base64=audio_b64,
        intent=nlp.intent,
        sources=sources,
    )


@router.post('', response_model=QueryResponse)
async def query_endpoint(request: QueryRequest):
    """
    Hard 45s cap — backend always responds before mobile's 60s axios timeout.
    If something hangs (e.g. Sarvam STT on a bad format), we return a
    clear Kannada error message instead of letting the mobile time out silently.
    """
    try:
        return await asyncio.wait_for(_run_query(request), timeout=45.0)
    except asyncio.TimeoutError:
        print('[Query] 45s overall timeout hit — returning error response')
        return QueryResponse(
            answer_text_kn=(
                'ಸರ್ವರ್ ತುಂಬಾ ನಿಧಾನವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.'
            ),
            error='query_timeout',
        )
