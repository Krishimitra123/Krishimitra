"""
Transcribe Router — Lightweight STT for onboarding voice input.
No Mistral, no TTS, no full query pipeline. Just Sarvam STT.
Accepts user's selected language so it transcribes in the right language.
"""

import asyncio
import os
from fastapi import APIRouter
from pydantic import BaseModel
from modules import m1_voice

router = APIRouter(prefix='/api/transcribe', tags=['transcribe'])


class TranscribeRequest(BaseModel):
    audio_base64: str
    audio_mime: str = 'audio/mp4'
    language_code: str = 'kn-IN'   # user's selected language


class TranscribeResponse(BaseModel):
    transcript: str
    language: str
    success: bool


@router.post('', response_model=TranscribeResponse)
async def transcribe_endpoint(request: TranscribeRequest):
    """
    STT-only endpoint for onboarding.
    Tries Sarvam first, falls back to Gemini 2.0 Flash.
    25s hard timeout.
    """
    sarvam_key = os.environ.get('SARVAM_API_KEY', '').strip()

    if not request.audio_base64 or len(request.audio_base64) < 500:
        return TranscribeResponse(transcript='', language=request.language_code, success=False)

    try:
        result = await asyncio.wait_for(
            m1_voice.audio_to_transcript(
                request.audio_base64,
                sarvam_key,  # May be empty — audio_to_transcript handles fallback
                mime_type=request.audio_mime,
                language_code=request.language_code,
            ),
            timeout=30.0,  # Increased to allow Gemini fallback
        )
        transcript = (result.get('transcript') or '').strip()
        print(f'[Transcribe] OK ({request.language_code}): "{transcript}"')
        return TranscribeResponse(
            transcript=transcript,
            language=request.language_code,
            success=bool(transcript),
        )
    except asyncio.TimeoutError:
        print('[Transcribe] Timed out after 30s')
        return TranscribeResponse(transcript='', language=request.language_code, success=False)
    except Exception as e:
        print(f'[Transcribe] Error: {e}')
        return TranscribeResponse(transcript='', language=request.language_code, success=False)
