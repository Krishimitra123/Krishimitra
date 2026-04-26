"""
Diagnose Router — Crop disease image diagnosis endpoint.
POST /api/diagnose

Separate from /api/query for dedicated image diagnosis flows.
"""

from fastapi import APIRouter
from models.schemas import DiagnosisRequest, DiagnosisResponse
from modules.m4_diagnosis import diagnose_image
from modules.m5_response import finding_to_kannada_text
from modules import m1_voice
import os
import traceback

router = APIRouter(prefix='/api', tags=['diagnosis'])


@router.post('/diagnose', response_model=DiagnosisResponse)
async def diagnose_endpoint(request: DiagnosisRequest):
    """
    POST /api/diagnose
    
    Input: { image_base64, image_mime, optional_text, user_context }
    Output: { finding, answer_text_kn, audio_base64 }
    """
    try:
        finding = await diagnose_image(request)

        # Convert finding to Kannada text response
        answer_kn = await finding_to_kannada_text(finding, request.user_context)

        # Generate TTS audio for the Kannada response
        audio_b64 = None
        try:
            audio_b64 = await m1_voice.text_to_audio(
                answer_kn, os.environ.get('SARVAM_API_KEY', '')
            )
        except Exception as tts_err:
            print(f'[Diagnose] TTS failed (non-fatal): {tts_err}')

        return DiagnosisResponse(
            finding=finding,
            answer_text_kn=answer_kn,
            audio_base64=audio_b64,
        )

    except Exception as e:
        traceback.print_exc()
        return DiagnosisResponse(
            answer_text_kn='ಚಿತ್ರ ವಿಶ್ಲೇಷಣೆಯಲ್ಲಿ ದೋಷ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.',
            error=str(e),
        )
