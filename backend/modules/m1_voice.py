"""
Module M1 — Voice (STT + TTS)
M4A from iOS is converted to WAV via ffmpeg subprocess before sending to Sarvam.
This is the ONLY reliable way to handle M4A in pure Python 3.13+.
All calls have hard asyncio timeouts.
"""

import asyncio
import base64
import os
import subprocess
import tempfile

import httpx


def _convert_audio_to_wav(audio_bytes: bytes, mime_type: str) -> bytes:
    """
    Convert any audio format to 16kHz mono WAV using ffmpeg.
    ffmpeg is installed at /opt/homebrew/bin/ffmpeg on this Mac.
    Falls back to original bytes if ffmpeg fails.
    """
    # Determine input format hint for ffmpeg
    fmt_map = {
        'audio/mp4': 'm4a',
        'audio/m4a': 'm4a',
        'audio/x-m4a': 'm4a',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/3gpp': '3gp',
        'audio/ogg': 'ogg',
        'audio/wav': None,   # Already WAV — skip conversion
        'audio/wave': None,
    }

    mime_lower = mime_type.lower()
    input_fmt = fmt_map.get(mime_lower, 'm4a')

    # Already WAV — no conversion needed
    if input_fmt is None:
        print(f'[M1-STT] Audio is already WAV — skipping conversion')
        return audio_bytes

    ffmpeg_path = '/opt/homebrew/bin/ffmpeg'
    if not os.path.exists(ffmpeg_path):
        ffmpeg_path = 'ffmpeg'  # Fallback to PATH

    try:
        # Write input to temp file, convert to WAV in-memory
        with tempfile.NamedTemporaryFile(suffix=f'.{input_fmt}', delete=False) as inf:
            inf.write(audio_bytes)
            in_path = inf.name

        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as outf:
            out_path = outf.name

        result = subprocess.run(
            [
                ffmpeg_path,
                '-y',                  # Overwrite output
                '-i', in_path,         # Input file
                '-ar', '16000',        # 16kHz sample rate
                '-ac', '1',            # Mono
                '-sample_fmt', 's16',  # 16-bit PCM
                out_path               # Output WAV
            ],
            capture_output=True,
            timeout=10,                # 10s max for conversion
        )

        if result.returncode == 0:
            with open(out_path, 'rb') as f:
                wav_bytes = f.read()
            print(f'[M1-STT] {input_fmt.upper()} ({len(audio_bytes)}B) → WAV ({len(wav_bytes)}B) ✓')
            return wav_bytes
        else:
            err = result.stderr.decode()[-200:]
            print(f'[M1-STT] ffmpeg failed: {err}')
            return audio_bytes

    except subprocess.TimeoutExpired:
        print('[M1-STT] ffmpeg conversion timed out (10s)')
        return audio_bytes
    except Exception as e:
        print(f'[M1-STT] Conversion error: {e}')
        return audio_bytes
    finally:
        # Clean up temp files
        for p in (in_path, out_path):
            try:
                os.unlink(p)
            except Exception:
                pass


async def audio_to_transcript(audio_base64: str, api_key: str, mime_type: str = 'audio/mp4') -> dict:
    """
    Decode base64 audio → convert to WAV via ffmpeg → send to Sarvam saarika:v2.5.
    Hard 20s timeout (belt-and-suspenders: httpx 20s + asyncio.wait_for 18s).
    """
    raw_bytes = base64.b64decode(audio_base64)

    # Convert to WAV (synchronous ffmpeg call, max 10s)
    wav_bytes = await asyncio.get_event_loop().run_in_executor(
        None, _convert_audio_to_wav, raw_bytes, mime_type
    )

    print(f'[M1-STT] Sending {len(wav_bytes)} bytes as audio.wav to Sarvam...')

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await asyncio.wait_for(
                client.post(
                    'https://api.sarvam.ai/speech-to-text',
                    headers={'api-subscription-key': api_key},
                    data={'language_code': 'kn-IN', 'model': 'saarika:v2.5'},
                    files={'file': ('audio.wav', wav_bytes, 'audio/wav')},
                ),
                timeout=18.0,
            )
    except asyncio.TimeoutError:
        raise ValueError('Sarvam STT timed out after 18s')

    if resp.status_code != 200:
        raise ValueError(f'STT {resp.status_code}: {resp.text[:200]}')

    transcript = (resp.json().get('transcript') or '').strip()
    print(f'[M1-STT] Transcript: "{transcript}"')
    return {'transcript': transcript, 'language': 'kn-IN', 'confidence': 1.0}


async def text_to_audio(text_kannada: str, api_key: str) -> str:
    """
    Kannada text → WAV base64 via Sarvam bulbul:v3.
    Hard 15s timeout. Non-fatal: returns '' on any failure.
    """
    text = text_kannada[:500]
    print(f'[M1-TTS] Generating audio for {len(text)} chars...')

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await asyncio.wait_for(
                client.post(
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
                    },
                ),
                timeout=13.0,
            )

        if resp.status_code != 200:
            print(f'[M1-TTS] Error {resp.status_code}: {resp.text[:100]}')
            return ''

        audios = resp.json().get('audios', [])
        audio = audios[0] if audios else ''
        if audio:
            print(f'[M1-TTS] Done — {len(audio)} chars')
        return audio

    except Exception as e:
        print(f'[M1-TTS] Failed (non-fatal): {e}')
        return ''
