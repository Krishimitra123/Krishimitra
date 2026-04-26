import asyncio
from dotenv import load_dotenv
load_dotenv('.env', override=True)
from modules import m7_ingest
import os
print("SUPABASE_URL:", os.environ.get('SUPABASE_URL'))
print(asyncio.run(m7_ingest.ingest_seed_chunks('corpus/seed_chunks.json')))
