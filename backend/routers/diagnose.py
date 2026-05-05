"""
Diagnose Router — Image-based crop disease diagnosis.
Generates a Kannada summary + TTS audio for the diagnosis result.
"""

import os
from fastapi import APIRouter, HTTPException
from models.schemas import DiagnosisRequest, DiagnosisFinding
from modules import m4_diagnosis, m1_voice

router = APIRouter(prefix='/api/diagnose', tags=['diagnose'])


def _build_kannada_summary(finding: DiagnosisFinding) -> str:
    """Build a natural Kannada prose summary from the diagnosis fields."""
    if finding.needs_retake:
        return 'ಚಿತ್ರ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಉತ್ತಮ ಬೆಳಕಿನಲ್ಲಿ ಮತ್ತೊಮ್ಮೆ ಫೋಟೋ ತೆಗೆಯಿರಿ.'

    parts = []

    # Disease identification
    disease = finding.disease_name_kn or finding.disease_name
    health = finding.plant_health_status.lower()
    if health in ('healthy', 'ಆರೋಗ್ಯಕರ'):
        parts.append('ನಿಮ್ಮ ಬೆಳೆ ಆರೋಗ್ಯಕರವಾಗಿದೆ. ಯಾವುದೇ ರೋಗ ಕಂಡುಬಂದಿಲ್ಲ.')
    else:
        parts.append(f'ನಿಮ್ಮ ಬೆಳೆಯಲ್ಲಿ {disease} ಕಂಡುಬಂದಿದೆ.')
        conf = int(finding.confidence_pct)
        parts.append(f'ವಿಶ್ವಾಸ ಮಟ್ಟ ಶೇಕಡಾ {conf}.')

    # Cause
    if finding.probable_cause and finding.probable_cause.lower() not in ('unknown', 'none', ''):
        parts.append(f'ಕಾರಣ: {finding.probable_cause}.')

    # Treatments
    if finding.organic_treatments:
        parts.append('ಜೈವಿಕ ಉಪಾಯಗಳು:')
        for i, t in enumerate(finding.organic_treatments[:3], 1):
            parts.append(f'{i}. {t}.')

    # Prevention
    if finding.prevention_measures:
        parts.append('ಮುಂಜಾಗ್ರತೆ:')
        for p in finding.prevention_measures[:2]:
            parts.append(f'• {p}.')

    return ' '.join(parts)


@router.post('', response_model=DiagnosisFinding)
async def diagnose_endpoint(request: DiagnosisRequest):
    try:
        finding = await m4_diagnosis.diagnose(request)

        # Generate Kannada summary
        summary_kn = _build_kannada_summary(finding)
        finding.summary_kn = summary_kn

        # Generate TTS audio for the Kannada summary
        sarvam_key = os.environ.get('SARVAM_API_KEY', '').strip()
        tts_lang = getattr(request, 'tts_language', 'kn') or 'kn'
        if sarvam_key and summary_kn:
            try:
                audio_b64 = await m1_voice.text_to_audio(summary_kn, sarvam_key, language=tts_lang)
                if audio_b64:
                    finding.audio_base64 = audio_b64
                    print(f'[Diagnose] TTS generated ({tts_lang}): {len(audio_b64)} chars')
            except Exception as e:
                print(f'[Diagnose] TTS failed (non-fatal): {e}')

        return finding
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
