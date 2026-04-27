import httpx
import base64
import os

async def audio_to_transcript(audio_base64: str, api_key: str) -> dict:
    """
    Decodes base64 audio and sends to Sarvam saarika:v2 for STT.
    """
    try:
        audio_bytes = base64.b64decode(audio_base64)
        
        # Write to temporary file for multipart upload
        # httpx handles file uploads nicely if we pass a tuple
        files = {
            'file': ('audio.wav', audio_bytes, 'audio/wav')
        }
        data = {
            'language_code': 'kn-IN',
            'model': 'saarika:v2'
        }
        
        headers = {
            'api-subscription-key': api_key
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                'https://api.sarvam.ai/speech-to-text',
                headers=headers,
                data=data,
                files=files
            )
            
            if response.status_code != 200:
                raise ValueError(f"Status {response.status_code}: {response.text}")
                
            resp_json = response.json()
            return {
                'transcript': resp_json.get('transcript', ''),
                'language': resp_json.get('language_code', 'kn-IN'),
                'confidence': 1.0 # default fallback if not provided by saarika
            }
            
    except Exception as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(str(e))

async def text_to_audio(text_kannada: str, api_key: str) -> str:
    """
    Converts Kannada text to MP3 base64 using Sarvam bulbul:v1 TTS.
    """
    # Truncate to 500 characters
    text = text_kannada[:500]
    
    payload = {
        "inputs": [text],
        "target_language_code": "kn-IN",
        "speaker": "meera",
        "pitch": 0,
        "pace": 0.95,
        "loudness": 1.5,
        "speech_sample_rate": 8000,
        "enable_preprocessing": True,
        "model": "bulbul:v1"
    }
    
    headers = {
        'api-subscription-key': api_key,
        'Content-Type': 'application/json'
    }
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            'https://api.sarvam.ai/text-to-speech',
            headers=headers,
            json=payload
        )
        
        if response.status_code != 200:
            raise ValueError(f"Status {response.status_code}: {response.text}")
            
        resp_json = response.json()
        audios = resp_json.get('audios', [])
        if not audios:
            raise ValueError("No audio returned from Sarvam API")
            
        return audios[0]
