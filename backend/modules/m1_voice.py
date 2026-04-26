"""
Module M1 — Voice Interface
Responsibility: Kannada audio ↔ text via Sarvam AI (Saarika STT / Bulbul TTS).
- audio_to_transcript(): WAV base64 → Kannada transcript
- text_to_audio(): Kannada text → WAV base64
"""

import httpx
import base64
import os
import io
from typing import Optional

SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text'
SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech'


async def audio_to_transcript(audio_base64: str, api_key: str) -> dict:
    """
    Calls Sarvam AI Saarika v2 STT.
    
    Args:
        audio_base64: Base64-encoded WAV audio (16kHz, mono)
        api_key: Sarvam AI subscription key
    
    Returns:
        { 'transcript': str, 'language': str, 'confidence': float }
    """
    if not api_key:
        raise ValueError('SARVAM_API_KEY is not configured')

    if not audio_base64:
        raise ValueError('Empty audio data received')

    try:
        audio_bytes = base64.b64decode(audio_base64)
    except Exception as e:
        raise ValueError(f'Invalid base64 audio data: {e}')

    if len(audio_bytes) < 100:
        raise ValueError(f'Audio too short ({len(audio_bytes)} bytes)')

    print(f'[M1-STT] Sending {len(audio_bytes)} bytes to Sarvam STT')

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            SARVAM_STT_URL,
            headers={'api-subscription-key': api_key},
            files={'file': ('audio.wav', io.BytesIO(audio_bytes), 'audio/wav')},
            data={'language_code': 'kn-IN', 'model': 'saarika:v2'},
        )

    if response.status_code != 200:
        error_detail = response.text[:500]
        print(f'[M1-STT] Error {response.status_code}: {error_detail}')
        raise ValueError(f'Sarvam STT error: {response.status_code} {error_detail}')

    data = response.json()
    transcript = data.get('transcript', '')
    print(f'[M1-STT] Transcript received: "{transcript[:100]}"')

    return {
        'transcript': transcript,
        'language': data.get('language_code', 'kn-IN'),
        'confidence': data.get('confidence', 0.0),
    }


async def text_to_audio(text_kannada: str, api_key: str) -> str:
    """
    Calls Sarvam AI Bulbul v2 TTS — optimized for crisp, clear output.
    
    Args:
        text_kannada: Kannada text to synthesise (max 500 chars)
        api_key: Sarvam AI subscription key
    
    Returns:
        Base64-encoded audio string (WAV)
    """
    if not api_key:
        raise ValueError('SARVAM_API_KEY is not configured')

    if not text_kannada or not text_kannada.strip():
        raise ValueError('Empty text for TTS')

    # Truncate to 500 chars for TTS (API limit)
    text = text_kannada[:500] if len(text_kannada) > 500 else text_kannada

    print(f'[M1-TTS] Synthesising {len(text)} chars of Kannada text')

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            SARVAM_TTS_URL,
            headers={
                'api-subscription-key': api_key,
                'Content-Type': 'application/json',
            },
            json={
                'inputs': [text],
                'target_language_code': 'kn-IN',
                'speaker': 'anushka',          # Clear female Kannada voice
                'pitch': 0,                    # Natural pitch
                'pace': 0.9,                   # Slightly slower for clarity
                'loudness': 1.2,               # Slightly louder without distortion
                'speech_sample_rate': 22050,   # CD-quality for crisp audio
                'enable_preprocessing': True,
                'model': 'bulbul:v2',
            },
        )

    if response.status_code != 200:
        error_detail = response.text[:500]
        print(f'[M1-TTS] Error {response.status_code}: {error_detail}')
        raise ValueError(f'Sarvam TTS error: {response.status_code} {error_detail}')

    audios = response.json().get('audios', [])
    if not audios:
        raise ValueError('TTS returned empty audio list')

    print(f'[M1-TTS] Audio generated, base64 length: {len(audios[0])}')
    return audios[0]  # base64 audio
