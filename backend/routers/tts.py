import asyncio
import os
from fastapi import APIRouter
from pydantic import BaseModel
from modules import m1_voice

router = APIRouter(prefix='/api/tts', tags=['tts'])

class TTSRequest(BaseModel):
    text: str
    language_code: str = 'kn-IN'

class TTSResponse(BaseModel):
    audio_base64: str | None

@router.post('', response_model=TTSResponse)
async def tts_endpoint(request: TTSRequest):
    sarvam_key = os.environ.get('SARVAM_API_KEY', '').strip()
    text = request.text.strip()
    if not sarvam_key or not text:
        print(f'[TTS] Skipping — key_set={bool(sarvam_key)}, text_len={len(text)}')
        return TTSResponse(audio_base64=None)

    print(f'[TTS] Generating audio for {len(text)} chars ({request.language_code})...')
    try:
        # Use the same proven m1_voice path as the chat pipeline,
        # but cap at 9s so we always respond before the client's 10s timeout.
        audio_b64 = await asyncio.wait_for(
            m1_voice.text_to_audio(text, sarvam_key, language_code=request.language_code),
            timeout=9.0
        )
        if audio_b64:
            print(f'[TTS] OK — {len(audio_b64)} chars')
            return TTSResponse(audio_base64=audio_b64)
        print('[TTS] Sarvam returned empty audio — device TTS will be used')
    except asyncio.TimeoutError:
        print('[TTS] Timed out after 9s — device TTS will be used')
    except Exception as e:
        print(f'[TTS] Error: {type(e).__name__}: {e}')

    return TTSResponse(audio_base64=None)
