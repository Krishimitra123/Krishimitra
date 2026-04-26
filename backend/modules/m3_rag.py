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
THRESHOLD     = float(os.environ.get('RAG_SIMILARITY_THRESHOLD', '0.60'))
TOP_K         = int(os.environ.get('RAG_TOP_K', '5'))

# ── Load once at startup (not per request) ───────────────────────
_model  = None
_client = None


def _ensure_loaded():
    """Lazy-load model and Supabase client to avoid import-time crashes."""
    global _model, _client
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    if _client is None and SUPABASE_URL and SUPABASE_KEY:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)


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
        """Returns formatted citation string in Kannada-readable format."""
        return f'{self.source_doc}, p.{self.source_page}'

    def to_dict(self) -> dict:
        return {
            'content': self.content,
            'source_doc': self.source_doc,
            'source_page': self.source_page,
            'category': self.category,
            'similarity': self.similarity,
        }


# ── Category Filter Map ─────────────────────────────────────────

CATEGORY_FILTER = {
    Intent.SOIL_QUERY:    'soil_fertility',
    Intent.BIOFERTILISER: 'biofertiliser',
    Intent.PEST_DISEASE:  'pest_disease',
    Intent.CERTIFICATION: 'certification',
}


async def retrieve(nlp_result: NLPResult) -> list:
    """
    Main M3 entry point.
    
    1. Embed the enriched query
    2. Query pgvector with optional category/crop filters
    3. Return list of RAGChunk (empty list if no match above threshold)
    
    Args:
        nlp_result: NLPResult from M2 with enriched_query and intent
    
    Returns:
        List of RAGChunk sorted by descending similarity.
        Empty list → caller should show KVK redirect message.
    """
    _ensure_loaded()

    if _client is None:
        # Supabase not configured — return empty (development mode)
        return []

    query_text = nlp_result.enriched_query

    # Embed the query
    embedding = _model.encode([query_text], normalize_embeddings=True)[0].tolist()

    # Determine filters
    category_filter = CATEGORY_FILTER.get(nlp_result.intent)   # None = search all categories
    crop_filter = nlp_result.entities.get('crop_name')          # None = search all crops

    # Call Supabase RPC function (match_chunks — defined in Section 4.1 SQL)
    response = _client.rpc('match_chunks', {
        'query_embedding': embedding,
        'match_threshold': THRESHOLD,
        'match_count':     TOP_K,
        'filter_category': category_filter,
        'filter_crop':     crop_filter,
    }).execute()

    if not response.data:
        return []  # No relevant chunks found → caller shows KVK redirect

    return [
        RAGChunk(
            content     = row['content'],
            source_doc  = row['source_doc'],
            source_page = row.get('source_page', 0),
            category    = row['category'],
            similarity  = row['similarity'],
        )
        for row in response.data
    ]
