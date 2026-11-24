"""
Module M3 — RAG Engine
Responsibility: Maintain verified organic farming knowledge base as pgvector DB.
Supports:
  1. Gemini Embeddings API (fast, low memory)
  2. SentenceTransformers (local multilingual embedding)
  3. Keyword fallback (ilike search) if vector retrieval produces no chunks
Ensures relevant chunks are ALWAYS fetched for agricultural queries.
"""

import os
import asyncio
import re
from typing import Optional
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

from supabase import create_client
from models.schemas import NLPResult, Intent

SUPABASE_URL  = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY  = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_KEY') or os.environ.get('SUPABASE_ANON_KEY', '')
GEMINI_KEY    = os.environ.get('GEMINI_API_KEY', '')
THRESHOLD     = float(os.environ.get('RAG_SIMILARITY_THRESHOLD', '0.20'))
TOP_K         = int(os.environ.get('RAG_TOP_K', '5'))

_client = None
_st_model = None


def _ensure_loaded():
    global _client
    if _client is None and SUPABASE_URL and SUPABASE_KEY:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print('[M3] Supabase client connected')


def _get_st_model():
    """Lazy-load sentence transformers model only if needed."""
    global _st_model
    if _st_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            model_name = os.environ.get('EMBEDDING_MODEL_NAME', 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2')
            _st_model = SentenceTransformer(model_name)
            print(f'[M3] Loaded local SentenceTransformer: {model_name}')
        except Exception as e:
            print(f'[M3] Could not load SentenceTransformer: {e}')
    return _st_model


class RAGChunk:
    def __init__(self, content: str, source_doc: str, source_page: int,
                 category: str, similarity: float):
        self.content     = content
        self.source_doc  = source_doc
        self.source_page = source_page or 1
        self.category    = category or 'organic_farming'
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


def _extract_keywords(text: str) -> list[str]:
    """Extract key agricultural search terms for fallback keyword search."""
    tokens = re.findall(r'[\u0C80-\u0CFF\w]{3,}', text.lower())
    stop_words = {
        'how', 'what', 'when', 'where', 'which', 'make', 'give', 'tell', 'help',
        'ಮಾಡು', 'ಹೇಗೆ', 'ತಿಳಿಸಿ', 'ಹೇಳಿ', 'ಯಾವ', 'ಬಗ್ಗೆ', 'ಎಷ್ಟು', 'ಯಾವಾಗ'
    }
    return [t for t in tokens if t not in stop_words]


async def _keyword_fallback_search(keywords: list[str], limit: int = 5) -> list[RAGChunk]:
    """Fallback text search in document_chunks table."""
    _ensure_loaded()
    if not _client or not keywords:
        return []

    for kw in keywords[:3]:
        try:
            res = _client.table('document_chunks') \
                .select('content, source_doc, source_page, category') \
                .ilike('content', f'%{kw}%') \
                .limit(limit) \
                .execute()

            if res.data:
                print(f'[M3] Keyword fallback matched {len(res.data)} chunks for "{kw}"')
                return [
                    RAGChunk(
                        content=row.get('content', ''),
                        source_doc=row.get('source_doc', 'Organic Farming Guide'),
                        source_page=row.get('source_page', 1),
                        category=row.get('category', 'general'),
                        similarity=0.65,
                    )
                    for row in res.data
                ]
        except Exception as e:
            print(f'[M3] Keyword fallback search error for "{kw}": {e}')

    return []


async def retrieve(nlp_result: NLPResult) -> list:
    """
    Main M3 entry point.
    Retrieves the most relevant knowledge chunks from Supabase pgvector.
    """
    _ensure_loaded()
    if _client is None:
        print('[M3] Supabase client not available')
        return []

    query_text = nlp_result.raw_transcript or nlp_result.enriched_query or nlp_result.normalised_query
    if not query_text:
        return []

    embedding = None

    # 1. Try Gemini API embedding if key is available
    if GEMINI_KEY:
        try:
            import google.genai as genai
            from google.genai import types as genai_types
            gemini_client = genai.Client(api_key=GEMINI_KEY)
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: gemini_client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=query_text,
                    config=genai_types.EmbedContentConfig(
                        task_type="retrieval_query",
                        output_dimensionality=768,
                    ),
                )
            )
            embedding = result.embeddings[0].values
            print(f'[M3] Gemini query embedding OK (dim={len(embedding)})')
        except Exception as e:
            print(f'[M3] Gemini embedding attempt failed: {e}')

    # 2. Try local SentenceTransformers if Gemini wasn't used or failed
    if embedding is None:
        model = _get_st_model()
        if model is not None:
            try:
                loop = asyncio.get_event_loop()
                embedding = await loop.run_in_executor(
                    None,
                    lambda: model.encode(query_text, normalize_embeddings=True).tolist()
                )
                print(f'[M3] Local ST query embedding OK (dim={len(embedding)})')
            except Exception as e:
                print(f'[M3] Local embedding failed: {e}')

    # 3. Call Supabase match_chunks RPC if embedding is available
    chunks = []
    if embedding and len(embedding) == 768:
        try:
            response = _client.rpc('match_chunks', {
                'query_embedding': embedding,
                'match_threshold': THRESHOLD,
                'match_count':     TOP_K,
            }).execute()

            if response.data:
                chunks = [
                    RAGChunk(
                        content     = row.get('content', ''),
                        source_doc  = row.get('source_doc', 'Unknown'),
                        source_page = row.get('source_page', 1),
                        category    = row.get('category', ''),
                        similarity  = row.get('similarity', 0.0),
                    )
                    for row in response.data
                ]
                print(f'[M3] Retrieved {len(chunks)} chunks via vector search (top: {chunks[0].similarity:.3f})')
                return chunks
            else:
                print('[M3] No chunks above vector threshold')
        except Exception as e:
            print(f'[M3] Vector RPC failed: {e}')

    # 4. Fallback to keyword search in document_chunks
    keywords = _extract_keywords(query_text)
    if nlp_result.normalised_query:
        keywords.extend(_extract_keywords(nlp_result.normalised_query))

    fallback_chunks = await _keyword_fallback_search(keywords, limit=TOP_K)
    if fallback_chunks:
        return fallback_chunks

    return []
