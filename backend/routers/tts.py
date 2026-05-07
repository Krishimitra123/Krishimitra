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
    if not sarvam_key or not request.text.strip():
        return TTSResponse(audio_base64=None)
    
    try:
        audio_b64 = await asyncio.wait_for(
            m1_voice.text_to_audio(request.text, sarvam_key, language_code=request.language_code),
            timeout=15.0
        )
        return TTSResponse(audio_base64=audio_b64)
    except Exception as e:
        print(f'[TTS] Error: {e}')
        return TTSResponse(audio_base64=None)
