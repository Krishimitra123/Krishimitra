import asyncio
import os
from dotenv import load_dotenv

load_dotenv()
from routers.query import query_endpoint
from models.schemas import QueryRequest, UserContext

async def test():
    # A dummy very short valid WAV file base64
    dummy_wav_b64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
    req = QueryRequest(audio_base64=dummy_wav_b64, user_context=UserContext())
    try:
        res = await query_endpoint(req)
        print("Success:", res.answer_text_kn, "Has audio:", bool(res.audio_base64))
    except Exception as e:
        print("Error:", repr(e))

asyncio.run(test())
