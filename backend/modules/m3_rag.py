"""
Module M3 — RAG Engine
Responsibility: Maintain verified organic farming knowledge base as pgvector DB.
Given enriched query from M2, retrieve top-K relevant document chunks with source metadata.

THIS IS THE ENTIRE INTELLIGENCE OF KRISHIMITRA.
The LLM only synthesises and translates — all knowledge comes from here.
"""

from sentence_transformers import SentenceTransformer
from supabase import create_client
from models.schemas import NLPResult, Intent
import os

SUPABASE_URL  = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY  = os.environ.get('SUPABASE_SERVICE_KEY', '')
MODEL_NAME    = os.environ.get('EMBEDDING_MODEL_NAME',
                'sentence-transformers/paraphrase-multilingual-mpnet-base-v2')
THRESHOLD     = float(os.environ.get('RAG_SIMILARITY_THRESHOLD', '0.35'))
TOP_K         = int(os.environ.get('RAG_TOP_K', '5'))

# ── Load once at startup (not per request) ───────────────────────
_model  = None
_client = None


def _ensure_loaded():
    """Lazy-load model and Supabase client to avoid import-time crashes."""
    global _model, _client
    if _model is None:
        print('[M3] Loading embedding model...')
        _model = SentenceTransformer(MODEL_NAME)
        print(f'[M3] Model loaded: {MODEL_NAME}')
    if _client is None and SUPABASE_URL and SUPABASE_KEY:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print('[M3] Supabase client connected')


class RAGChunk:
    """A single retrieved document chunk with similarity score and metadata."""

    def __init__(self, content: str, source_doc: str, source_page: int,
                 category: str, similarity: float):
        self.content     = content
        self.source_doc  = source_doc
        self.source_page = source_page
        self.category    = category
        self.similarity  = similarity

    def citation(self) -> str:
        """Returns formatted citation string."""
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
    Main M3 entry point.
    
    1. Embed the enriched query
    2. Query pgvector via Supabase match_chunks RPC
    3. Return list of RAGChunk (empty list if no match above threshold)
    """
    _ensure_loaded()

    if _client is None:
        print('[M3] Supabase not configured — skipping RAG')
        return []

    # Use the raw transcript for embedding (Kannada text works with multilingual model)
    query_text = nlp_result.raw_transcript or nlp_result.enriched_query
    if not query_text:
        return []

    # Embed the query
    embedding = _model.encode([query_text], normalize_embeddings=True)[0].tolist()
    print(f'[M3] Embedding query: "{query_text[:50]}..."')

    # Call Supabase RPC function
    try:
        response = _client.rpc('match_chunks', {
            'query_embedding': embedding,
            'match_threshold': THRESHOLD,
            'match_count':     TOP_K,
        }).execute()
    except Exception as e:
        # If RPC has extra params the function doesn't support, try simpler call
        print(f'[M3] RPC call failed: {e}')
        return []

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
    
    print(f'[M3] Retrieved {len(chunks)} chunks (top: {chunks[0].similarity:.3f} from {chunks[0].source_doc})')
    return chunks

