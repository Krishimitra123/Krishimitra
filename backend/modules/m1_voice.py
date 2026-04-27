import httpx
import base64
import os

async def audio_to_transcript(audio_base64: str, api_key: str, mime_type: str = 'audio/mp4') -> dict:
    """
    Decodes base64 audio and sends to Sarvam saarika:v2.5 for STT.
    Supports: audio/wav (.wav), audio/mp4 (.m4a), audio/mpeg (.mp3)
    """
    try:
        audio_bytes = base64.b64decode(audio_base64)

        # Determine filename extension from mime type
        mime_ext_map = {
            'audio/wav': ('audio.wav', 'audio/wav'),
            'audio/wave': ('audio.wav', 'audio/wav'),
            'audio/mp4': ('audio.m4a', 'audio/mp4'),
            'audio/m4a': ('audio.m4a', 'audio/mp4'),
            'audio/mpeg': ('audio.mp3', 'audio/mpeg'),
            'audio/mp3': ('audio.mp3', 'audio/mpeg'),
        }
        filename, content_type = mime_ext_map.get(mime_type.lower(), ('audio.m4a', 'audio/mp4'))

        print(f'[M1-STT] Sending {len(audio_bytes)} bytes as {filename} to Sarvam...')

        files = {
            'file': (filename, audio_bytes, content_type)
        }
        data = {
            'language_code': 'kn-IN',
            'model': 'saarika:v2.5'
        }
        headers = {
            'api-subscription-key': api_key
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                'https://api.sarvam.ai/speech-to-text',
                headers=headers,
                data=data,
                files=files
            )

            if response.status_code != 200:
                raise ValueError(f"STT Status {response.status_code}: {response.text}")

            resp_json = response.json()
            transcript = resp_json.get('transcript', '').strip()
            print(f'[M1-STT] Transcript: "{transcript}"')
            return {
                'transcript': transcript,
                'language': resp_json.get('language_code', 'kn-IN'),
                'confidence': 1.0
            }

    except Exception as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(str(e))


async def text_to_audio(text_kannada: str, api_key: str) -> str:
    """
    Converts Kannada text to WAV base64 using Sarvam bulbul:v3 TTS.
    Returns base64-encoded audio string.
    """
    # Truncate to 500 characters per API limit
    text = text_kannada[:500]

    payload = {
        "inputs": [text],
        "target_language_code": "kn-IN",
        "speaker": "amit",
        "speech_sample_rate": 8000,
        "enable_preprocessing": True,
        "model": "bulbul:v3"
    }

    headers = {
        'api-subscription-key': api_key,
        'Content-Type': 'application/json'
    }

    print(f'[M1-TTS] Generating audio for {len(text)} chars...')

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            'https://api.sarvam.ai/text-to-speech',
            headers=headers,
            json=payload
        )

        if response.status_code != 200:
            raise ValueError(f"TTS Status {response.status_code}: {response.text}")

        resp_json = response.json()
        audios = resp_json.get('audios', [])
        if not audios:
            raise ValueError("No audio returned from Sarvam TTS API")

        print(f'[M1-TTS] Audio generated, base64 length: {len(audios[0])}')
        return audios[0]
