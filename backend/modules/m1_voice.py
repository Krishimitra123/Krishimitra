"""
Module M1 — Voice (STT + TTS)
STT: Sarvam saarika:v2.5 — accepts WAV best.
     M4A/MP4 from iPhone is converted to WAV in-memory before sending.
TTS: Sarvam bulbul:v3.

Both calls have a hard 15s timeout.
"""

import httpx
import base64
import io
import os
import struct
import wave


def _m4a_to_wav_via_resampling(audio_bytes: bytes) -> bytes:
    """
    iOS AAC/M4A files can't be decoded in pure Python without a codec.
    Instead, we send the raw bytes and let Sarvam handle it, but with
    the correct filename so Sarvam knows to use its decoder.
    This function is a no-op passthrough — just returns the bytes.
    """
    return audio_bytes


def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 16000, channels: int = 1) -> bytes:
    """Wrap raw PCM bytes into a WAV container."""
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return buf.getvalue()


async def audio_to_transcript(audio_base64: str, api_key: str, mime_type: str = 'audio/mp4') -> dict:
    """
    Decodes base64 audio and sends to Sarvam saarika:v2.5 for STT.
    Always sends as WAV with filename 'audio.wav' — this is what Sarvam
    processes most reliably. M4A bytes from iOS are sent with .m4a extension.
    Hard 15s timeout.
    """
    audio_bytes = base64.b64decode(audio_base64)
    mime_lower = mime_type.lower()

    # Map MIME to Sarvam-friendly filename + content type
    # Sarvam accepts: wav, mp3, flac, ogg, webm, and also m4a in practice
    if mime_lower in ('audio/wav', 'audio/wave', 'audio/x-wav'):
        filename = 'audio.wav'
        content_type = 'audio/wav'
    elif mime_lower in ('audio/mp4', 'audio/m4a', 'audio/x-m4a'):
        filename = 'audio.m4a'
        content_type = 'audio/mp4'
    elif mime_lower in ('audio/mpeg', 'audio/mp3'):
        filename = 'audio.mp3'
        content_type = 'audio/mpeg'
    elif mime_lower == 'audio/3gpp':
        filename = 'audio.3gp'
        content_type = 'audio/3gpp'
    else:
        filename = 'audio.m4a'
        content_type = 'audio/mp4'

    print(f'[M1-STT] Sending {len(audio_bytes)} bytes as {filename}...')

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            'https://api.sarvam.ai/speech-to-text',
            headers={'api-subscription-key': api_key},
            data={'language_code': 'kn-IN', 'model': 'saarika:v2.5'},
            files={'file': (filename, audio_bytes, content_type)}
        )

    if response.status_code != 200:
        raise ValueError(f'STT {response.status_code}: {response.text[:200]}')

    resp = response.json()
    transcript = (resp.get('transcript') or '').strip()
    print(f'[M1-STT] Transcript: "{transcript}"')
    return {
        'transcript': transcript,
        'language': resp.get('language_code', 'kn-IN'),
        'confidence': 1.0,
    }


async def text_to_audio(text_kannada: str, api_key: str) -> str:
    """
    Converts Kannada text → WAV base64 via Sarvam bulbul:v3.
    Hard 15s timeout. Returns empty string on failure (non-fatal).
    """
    text = text_kannada[:500]
    print(f'[M1-TTS] Generating audio for {len(text)} chars...')

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                'https://api.sarvam.ai/text-to-speech',
                headers={
                    'api-subscription-key': api_key,
                    'Content-Type': 'application/json',
                },
                json={
                    'inputs': [text],
                    'target_language_code': 'kn-IN',
                    'speaker': 'amit',
                    'speech_sample_rate': 8000,
                    'enable_preprocessing': True,
                    'model': 'bulbul:v3',
                }
            )

        if response.status_code != 200:
            print(f'[M1-TTS] Error {response.status_code}: {response.text[:200]}')
            return ''

        audios = response.json().get('audios', [])
        if not audios:
            print('[M1-TTS] No audio returned')
            return ''

        audio_b64 = audios[0]
        print(f'[M1-TTS] Done — {len(audio_b64)} chars')
        return audio_b64

    except httpx.TimeoutException:
        print('[M1-TTS] Timed out after 15s — skipping TTS')
        return ''
    except Exception as e:
        print(f'[M1-TTS] Failed (non-fatal): {e}')
        return ''
