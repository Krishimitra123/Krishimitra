"""
Diagnose Router — Image-based crop disease diagnosis.
Generates a Kannada summary + TTS audio for the diagnosis result.
"""

import os
from fastapi import APIRouter, HTTPException
from models.schemas import DiagnosisRequest, DiagnosisFinding
from modules import m4_diagnosis, m1_voice

router = APIRouter(prefix='/api/diagnose', tags=['diagnose'])

# Fallback English→Kannada disease name translations (for cases where API doesn't return Kannada)
DISEASE_NAME_FALLBACK = {
    'powdery mildew': 'ಬೂದಿ ರೋಗ',
    'leaf spot': 'ಎಲೆ ಚುಕ್ಕೆ ರೋಗ',
    'rust': 'ತುಪ್ಪೆ ರೋಗ',
    'blight': 'ಆತ್ಮಘಾತ ರೋಗ',
    'anthracnose': 'ಆಂತ್ರಕ್ನೋಸ್ ರೋಗ',
    'wilt': 'ಎಳೆಯುವ ರೋಗ',
    'mosaic': 'ಮಿಶ್ರ ಚಿಹ್ನೆ ರೋಗ',
    'rot': 'ಕೊಳೆಯುವ ರೋಗ',
    'canker': 'ಮಂಕು ರೋಗ',
    'scab': 'ಕೀಟ ರೋಗ',
}


def _resolve_kannada_disease_name(finding: DiagnosisFinding) -> str:
    disease_name_kn = (finding.disease_name_kn or '').split('(')[0].strip()
    disease_name_en = finding.disease_name or ''

    if disease_name_kn:
        return disease_name_kn

    if disease_name_en:
        en_lower = disease_name_en.lower()
        for en_key, kn_val in DISEASE_NAME_FALLBACK.items():
            if en_key in en_lower:
                return kn_val
        return disease_name_en

    return 'ತಿಳಿದಿರದ ರೋಗ'


def _build_summary(finding: DiagnosisFinding, lang: str) -> str:
    """Build a natural prose summary from the diagnosis fields in the preferred language."""
    is_en = lang.startswith('en')
    if finding.needs_retake:
        return 'Image is unclear. Please take another photo in good lighting.' if is_en else 'ಚಿತ್ರ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಉತ್ತಮ ಬೆಳಕಿನಲ್ಲಿ ಮತ್ತೊಮ್ಮೆ ಫೋಟೋ ತೆಗೆಯಿರಿ.'

    parts = []

    # Disease identification
    final_disease_name = finding.disease_name if is_en else _resolve_kannada_disease_name(finding)
    health = finding.plant_health_status.lower() if finding.plant_health_status else ''
    
    if health in ('healthy', 'ಆರೋಗ್ಯಕರ'):
        parts.append('Your crop is healthy. No disease found.' if is_en else 'ನಿಮ್ಮ ಬೆಳೆ ಆರೋಗ್ಯಕರವಾಗಿದೆ. ಯಾವುದೇ ರೋಗ ಕಂಡುಬಂದಿಲ್ಲ.')
    else:
        parts.append(f'Your crop has {final_disease_name}.' if is_en else f'ನಿಮ್ಮ ಬೆಳೆಗೆ {final_disease_name} ಇದೆ.')
        
        if finding.confidence_pct and finding.confidence_pct > 0:
            conf = int(finding.confidence_pct)
            parts.append(f'Confidence level {conf}%.' if is_en else f'ವಿಶ್ವಾಸ ಮಟ್ಟ ಶೇಕಡಾ {conf}.')

    # Cause
    if finding.probable_cause and finding.probable_cause.lower() not in ('unknown', 'none', ''):
        parts.append(f'Cause: {finding.probable_cause}.' if is_en else f'ಕಾರಣ: {finding.probable_cause}.')

    # Treatments
    if finding.organic_treatments:
        parts.append('Organic Treatment:' if is_en else 'ಜೈವಿಕ ಚಿಕಿತ್ಸೆ:')
        for i, t in enumerate(finding.organic_treatments[:3], 1):
            parts.append(f'{i}. {t}.')

    # Prevention
    if finding.prevention_measures:
        parts.append('Prevention:' if is_en else 'ಮುಂಜಾಗ್ರತೆ:')
        for p in finding.prevention_measures[:2]:
            parts.append(f'{p}.')

    return ' '.join(parts)


def _build_audio_text(finding: DiagnosisFinding, lang: str) -> list[str]:
    is_en = lang.startswith('en')
    if finding.needs_retake:
        return ['Image is unclear. Please take another photo in good lighting.'] if is_en else ['ಚಿತ್ರ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಉತ್ತಮ ಬೆಳಕಿನಲ್ಲಿ ಮತ್ತೊಮ್ಮೆ ಫೋಟೋ ತೆಗೆಯಿರಿ.']

    disease_name = finding.disease_name if is_en else _resolve_kannada_disease_name(finding)
    health = finding.plant_health_status.lower() if finding.plant_health_status else ''

    intro_parts = []
    body_parts = []

    if health in ('healthy', 'ಆರೋಗ್ಯಕರ'):
        intro_parts.append('Your crop is healthy. No disease found.' if is_en else 'ನಿಮ್ಮ ಬೆಳೆ ಆರೋಗ್ಯಕರವಾಗಿದೆ. ಯಾವುದೇ ರೋಗ ಕಂಡುಬಂದಿಲ್ಲ.')
    else:
        intro_parts.append(f'Your crop has {disease_name}.' if is_en else f'ನಿಮ್ಮ ಬೆಳೆಗೆ {disease_name} ಇದೆ.')
        if finding.confidence_pct and finding.confidence_pct > 0:
            intro_parts.append(f'Confidence level {int(finding.confidence_pct)}%.' if is_en else f'ವಿಶ್ವಾಸ ಮಟ್ಟ ಶೇಕಡಾ {int(finding.confidence_pct)}.')

    if finding.probable_cause and finding.probable_cause.lower() not in ('unknown', 'none', ''):
        body_parts.append(f'Cause: {finding.probable_cause}.' if is_en else f'ಕಾರಣ: {finding.probable_cause}.')

    if finding.organic_treatments:
        body_parts.append('Organic Treatment:' if is_en else 'ಜೈವಿಕ ಚಿಕಿತ್ಸೆ:')
        for i, t in enumerate(finding.organic_treatments[:3], 1):
            body_parts.append(f'{i}. {t}.')

    if finding.prevention_measures:
        body_parts.append('Prevention:' if is_en else 'ಮುಂಜಾಗ್ರತೆ:')
        for p in finding.prevention_measures[:2]:
            body_parts.append(f'{p}.')

    texts = [' '.join(intro_parts)]
    if body_parts:
        texts.append(' '.join(body_parts))
    return texts


@router.post('', response_model=DiagnosisFinding)
async def diagnose_endpoint(request: DiagnosisRequest):
    try:
        finding = await m4_diagnosis.diagnose(request)

        # Get language
        sarvam_key = os.environ.get('SARVAM_API_KEY', '').strip()
        tts_lang = (
            request.user_context.preferred_language
            if request.user_context and request.user_context.preferred_language
            else request.preferred_language
            or request.tts_language
            or 'kn-IN'
        )

        # Generate summary in preferred language
        summary_text = _build_summary(finding, tts_lang)
        finding.summary_kn = summary_text
        
        print(f'[Diagnose] Disease: {finding.disease_name_kn or finding.disease_name}')
        print(f'[Diagnose] Health: {finding.plant_health_status}')
        print(f'[Diagnose] Summary: {summary_text[:200]}...')

        if sarvam_key and summary_text:
            try:
                audio_texts = _build_audio_text(finding, tts_lang)
                audio_parts = []
                for idx, audio_text in enumerate(audio_texts, 1):
                    audio_b64 = await m1_voice.text_to_audio(audio_text, sarvam_key, language_code=tts_lang)
                    if audio_b64:
                        audio_parts.append(audio_b64)
                        print(f'[Diagnose] TTS segment {idx}/{len(audio_texts)} generated ({tts_lang}): {len(audio_b64)} chars')
                    else:
                        print(f'[Diagnose] TTS segment {idx}/{len(audio_texts)} returned empty audio')

                if audio_parts:
                    finding.audio_base64 = audio_parts[0] if len(audio_parts) == 1 else m1_voice._concat_wav_base64(audio_parts)
                    print(f'[Diagnose] TTS generated ({tts_lang}): {len(finding.audio_base64)} chars')
                else:
                    print('[Diagnose] TTS returned empty audio')
            except Exception as e:
                print(f'[Diagnose] TTS failed (non-fatal): {e}')

        return finding
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
