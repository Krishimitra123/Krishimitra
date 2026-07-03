import asyncio
import base64
import os
import subprocess
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/Users/mohammedshakeeb/Desktop/KrishiMitra/backend/.env', override=True)

from modules.m1_voice import audio_to_transcript, text_to_audio

async def main():
    sarvam_key = os.environ.get('SARVAM_API_KEY', '')
    gemini_key = os.environ.get('GEMINI_API_KEY', '')
    print(f"Sarvam Key: {sarvam_key[:10]}...")
    print(f"Gemini Key: {gemini_key[:10]}...")

    # 1. Generate a 2-second silent WAV file using ffmpeg
    wav_path = 'temp_test.wav'
    print("Generating silent WAV file...")
    subprocess.run([
        'ffmpeg', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono',
        '-t', '2', '-acodec', 'pcm_s16le', wav_path
    ], capture_output=True)

    with open(wav_path, 'rb') as f:
        audio_bytes = f.read()
    
    audio_base64 = base64.b64encode(audio_bytes).decode()
    
    # Clean up
    if os.path.exists(wav_path):
        os.remove(wav_path)

    print(f"Audio Base64 length: {len(audio_base64)}")

    # 2. Test STT
    print("\n--- Testing STT ---")
    try:
        stt_res = await audio_to_transcript(
            audio_base64,
            sarvam_key,
            mime_type='audio/wav',
            language_code='kn-IN'
        )
        print("STT Result:", stt_res)
    except Exception as e:
        print("STT Exception:", e)

    # 3. Test TTS
    print("\n--- Testing TTS ---")
    try:
        tts_res = await text_to_audio(
            "ನಮಸ್ಕಾರ, ನಾನು ಕೃಷಿಮಿತ್ರ ಸಹಾಯಕ.",
            sarvam_key,
            language_code='kn-IN'
        )
        print("TTS Result Length:", len(tts_res) if tts_res else 0)
    except Exception as e:
        print("TTS Exception:", e)

if __name__ == '__main__':
    asyncio.run(main())
