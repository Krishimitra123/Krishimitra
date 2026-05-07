"""
Module M3 — RAG Engine (API-based)
Responsibility: Maintain verified organic farming knowledge base as pgvector DB.
Uses Gemini Embeddings API to save local RAM — essential for Render Free Tier.
"""

import os
import asyncio
import google.generativeai as genai
from supabase import create_client
from models.schemas import NLPResult, Intent

SUPABASE_URL  = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY  = os.environ.get('SUPABASE_SERVICE_KEY', '')
GEMINI_KEY    = os.environ.get('GEMINI_API_KEY', '')
THRESHOLD     = float(os.environ.get('RAG_SIMILARITY_THRESHOLD', '0.35'))
TOP_K         = int(os.environ.get('RAG_TOP_K', '5'))

# ── Load once at startup ─────────────────────────────────────────
_client = None

def _ensure_loaded():
    global _client
    if _client is None and SUPABASE_URL and SUPABASE_KEY:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print('[M3] Supabase client connected')
    if GEMINI_KEY:
        genai.configure(api_key=GEMINI_KEY)

class RAGChunk:
    def __init__(self, content: str, source_doc: str, source_page: int,
                 category: str, similarity: float):
        self.content     = content
        self.source_doc  = source_doc
        self.source_page = source_page
        self.category    = category
        self.similarity  = similarity

    def citation(self) -> str:
        return f'{self.source_doc}, p.{self.source_page}'

    def to_dict(self) -> dict:
        return {
            'content': self.content,
            'source_doc': self.source_doc,
            'source_page': self.source_page,
            'category': self.category,
            'similarity': self.similarity,
        }

async def retrieve(nlp_result: NLPResult) -> list:
    """
    Main M3 entry point using Gemini Embeddings.
    Saves ~600MB RAM vs local SentenceTransformers.
    """
    _ensure_loaded()

    if _client is None or not GEMINI_KEY:
        print('[M3] Supabase or Gemini not configured — skipping RAG')
        return []

    query_text = nlp_result.raw_transcript or nlp_result.enriched_query
    if not query_text:
        return []

    try:
        # Get embeddings from Gemini (768 dimensions)
        # We use await to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: genai.embed_content(
                model="models/embedding-001",
                content=query_text,
                task_type="retrieval_query",
            )
        )
        embedding = result['embedding']
        print(f'[M3] Gemini embedding generated (dim={len(embedding)})')

        # Call Supabase RPC
        response = _client.rpc('match_chunks', {
            'query_embedding': embedding,
            'match_threshold': THRESHOLD,
            'match_count':     TOP_K,
        }).execute()

        if not response.data:
            print('[M3] No chunks above threshold')
            return []

        chunks = [
            RAGChunk(
                content     = row.get('content', ''),
                source_doc  = row.get('source_doc', 'Unknown'),
                source_page = row.get('source_page', 0),
                category    = row.get('category', ''),
                similarity  = row.get('similarity', 0.0),
            )
            for row in response.data
        ]
        
        print(f'[M3] Retrieved {len(chunks)} chunks (top: {chunks[0].similarity:.3f})')
        return chunks

    except Exception as e:
        print(f'[M3] RAG failed: {e}')
        return []
