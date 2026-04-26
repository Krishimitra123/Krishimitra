import asyncio
from dotenv import load_dotenv
load_dotenv('.env', override=True)
from modules import m2_nlp, m3_rag, m5_response, m6_guard
import os

async def test():
    print("Testing M2 NLP...")
    nlp = await m2_nlp.process("How do I prepare Jeevamrutha?", None)
    print("NLP Intent:", nlp.intent)
    print("Testing M3 RAG...")
    chunks = await m3_rag.retrieve(nlp)
    print("RAG Chunks:", len(chunks))
    print("Testing M5 Response...")
    ans, sources = await m5_response.generate(nlp, chunks)
    print("Answer:", ans[:50])

asyncio.run(test())
