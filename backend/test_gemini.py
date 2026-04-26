import asyncio
import os
from dotenv import load_dotenv
load_dotenv('.env', override=True)
import google.generativeai as genai

async def test():
    print("Testing Gemini...")
    genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
    model = genai.GenerativeModel('gemini-2.5-flash')
    res = await model.generate_content_async("Hello")
    print(res.text)

asyncio.run(test())
