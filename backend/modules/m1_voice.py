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


def _normalize_language_code(language_code: str | None) -> str:
    code = (language_code or 'kn-IN').strip()
    aliases = {
        'kn': 'kn-IN',
        'kn-IN': 'kn-IN',
        'en': 'en-IN',
        'en-IN': 'en-IN',
        'hi': 'hi-IN',
        'hi-IN': 'hi-IN',
        'ta': 'ta-IN',
        'ta-IN': 'ta-IN',
        'te': 'te-IN',
        'te-IN': 'te-IN',
        'ml': 'ml-IN',
        'ml-IN': 'ml-IN',
        'mr': 'mr-IN',
        'mr-IN': 'mr-IN',
        'bn': 'bn-IN',
        'bn-IN': 'bn-IN',
        'gu': 'gu-IN',
        'gu-IN': 'gu-IN',
        'pa': 'pa-IN',
        'pa-IN': 'pa-IN',
        'od': 'or-IN',
        'or-IN': 'or-IN',
    }
    return aliases.get(code, code)


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
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await asyncio.wait_for(
                client.post(
                    'https://api.sarvam.ai/speech-to-text',
                    headers={'api-subscription-key': api_key},
                    data={'language_code': 'kn-IN', 'model': 'saarika:v2.5'},
                    files={'file': ('audio.wav', wav_bytes, 'audio/wav')},
                ),
                timeout=14.0,
            )
    except asyncio.TimeoutError:
        raise ValueError('Sarvam STT timed out after 14s')

    if resp.status_code != 200:
        raise ValueError(f'STT {resp.status_code}: {resp.text[:200]}')

    transcript = (resp.json().get('transcript') or '').strip()
    print(f'[M1-STT] Transcript: "{transcript}"')
    return {'transcript': transcript, 'language': 'kn-IN', 'confidence': 1.0}


async def text_to_audio(text: str, api_key: str, language_code: str = 'kn-IN') -> str:
    """
    Text → WAV base64 via Sarvam Bulbul.
    Supports Kannada and the other Sarvam TTS languages.
    Splits long text into sentence-level chunks (max 450 chars each),
    generates audio for each, and concatenates WAV data.
    Non-fatal: returns '' on failure.
    """
    if not text or len(text.strip()) < 5:
        return ''

    LANGUAGE_SPEAKER_MAP = {
        'kn-IN': 'meera',
        'hi-IN': 'arvind',
        'ta-IN': 'anitha',
        'te-IN': 'vijay',
        'ml-IN': 'neel',
        'mr-IN': 'meera',
        'bn-IN': 'meera',
        'gu-IN': 'meera',
        'pa-IN': 'meera',
        'or-IN': 'meera',
        'en-IN': 'meera',
    }
    lang_code = _normalize_language_code(language_code)
    speaker_candidates = [LANGUAGE_SPEAKER_MAP.get(lang_code, 'aditya')]
    env_speaker = os.environ.get('SARVAM_TTS_SPEAKER', '').strip()
    if env_speaker and env_speaker not in speaker_candidates:
        speaker_candidates.append(env_speaker)
    if 'aditya' not in speaker_candidates:
        speaker_candidates.append('aditya')

    # Split into sentence-sized chunks that fit Sarvam's limit
    chunks = _split_text_for_tts(text.strip(), max_chars=450)
    print(f'[M1-TTS] Generating {lang_code} audio for {len(text)} chars in {len(chunks)} chunk(s)...')

    audio_parts: list[str] = []
    for i, chunk in enumerate(chunks):
        chunk_audio = ''
        for speaker_name in speaker_candidates:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await asyncio.wait_for(
                        client.post(
                            'https://api.sarvam.ai/text-to-speech',
                            headers={
                                'api-subscription-key': api_key,
                                'Content-Type': 'application/json',
                            },
                            json={
                                'inputs': [chunk],
                                'target_language_code': lang_code,
                                'speaker': speaker_name,
                                'model': 'bulbul:v3',
                            },
                        ),
                        timeout=9.0,
                    )

                if resp.status_code == 200:
                    audios = resp.json().get('audios', [])
                    if audios and audios[0]:
                        chunk_audio = audios[0]
                        print(f'[M1-TTS] Chunk {i+1}/{len(chunks)} via {speaker_name}: {len(chunk_audio)} chars')
                        break

                print(f'[M1-TTS] Chunk {i+1} error {resp.status_code} via {speaker_name}: {resp.text[:200]}')
            except Exception as e:
                print(f'[M1-TTS] Chunk {i+1} failed via {speaker_name}: {e}')

        if chunk_audio:
            audio_parts.append(chunk_audio)

    if not audio_parts:
        print('[M1-TTS] No audio generated')
        return ''

    if len(audio_parts) == 1:
        print(f'[M1-TTS] Done — {len(audio_parts[0])} chars')
        return audio_parts[0]

    # Concatenate multiple WAV base64 parts
    combined = _concat_wav_base64(audio_parts)
    print(f'[M1-TTS] Combined {len(audio_parts)} chunks → {len(combined)} chars')
    return combined


def _split_text_for_tts(text: str, max_chars: int = 450) -> list[str]:
    """Split text on sentence boundaries (।, ., !, ?) into chunks under max_chars."""
    if len(text) <= max_chars:
        return [text]

    import re
    # Split on Kannada/English sentence enders
    sentences = re.split(r'(?<=[।.!?])\s*', text)
    chunks: list[str] = []
    current = ''

    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        if len(current) + len(sent) + 1 <= max_chars:
            current = (current + ' ' + sent).strip() if current else sent
        else:
            if current:
                chunks.append(current)
            current = sent[:max_chars]  # Truncate single very long sentence

    if current:
        chunks.append(current)

    return chunks or [text[:max_chars]]


def _find_wav_data_offset(wav_bytes: bytes) -> tuple[int, int]:
    """
    Parse WAV RIFF structure to find the byte offset and size of the 'data' chunk.
    Returns (data_start_offset, data_size).
    Falls back to (44, remaining) for malformed files.
    """
    import struct
    if len(wav_bytes) < 12 or wav_bytes[:4] != b'RIFF' or wav_bytes[8:12] != b'WAVE':
        return 44, max(0, len(wav_bytes) - 44)

    offset = 12  # Skip the 12-byte RIFF+size+WAVE header
    while offset + 8 <= len(wav_bytes):
        chunk_id = wav_bytes[offset:offset + 4]
        chunk_size = struct.unpack_from('<I', wav_bytes, offset + 4)[0]
        if chunk_id == b'data':
            return offset + 8, chunk_size
        offset += 8 + chunk_size
        if chunk_size % 2 != 0:
            offset += 1  # WAV chunks are padded to even byte boundaries

    return 44, max(0, len(wav_bytes) - 44)


def _concat_wav_base64(parts: list[str]) -> str:
    """
    Concatenate multiple WAV base64 strings into one by merging PCM data.
    Properly parses the WAV chunk structure — does NOT assume data starts at byte 44.
    """
    import struct

    decoded = [base64.b64decode(p) for p in parts]

    first = decoded[0]
    if len(first) < 44:
        return parts[0]

    # Find where the actual PCM data starts in the first WAV
    data_offset, _ = _find_wav_data_offset(first)

    # Collect PCM data from all chunks
    pcm_data = first[data_offset:]
    for wav in decoded[1:]:
        offset, _ = _find_wav_data_offset(wav)
        if len(wav) > offset:
            pcm_data += wav[offset:]

    data_size = len(pcm_data)
    # RIFF chunk size = everything after the first 8 bytes (RIFF + size field)
    riff_chunk_size = (data_offset - 8) + data_size

    # Copy the full original header up to the data offset
    header = bytearray(first[:data_offset])

    # Patch RIFF chunk size at offset 4
    struct.pack_into('<I', header, 4, riff_chunk_size)
    # Patch data chunk size at (data_offset - 4)
    struct.pack_into('<I', header, data_offset - 4, data_size)

    combined_wav = bytes(header) + pcm_data
    result = base64.b64encode(combined_wav).decode()
    print(f'[M1-TTS] WAV concat: {len(parts)} parts, data_offset={data_offset}, '
          f'pcm={data_size}B → {len(result)} chars')
    return result

