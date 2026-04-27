"""
M3 RAG Engine — Retrieval-Augmented Generation module.
Embeds queries, retrieves relevant chunks from Supabase pgvector,
and returns ranked RAGChunk objects for downstream response generation.
"""

import os
from dataclasses import dataclass, field
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from sentence_transformers import SentenceTransformer
from supabase import create_client, Client

# ── Model & Client (loaded once at module startup) ────────────────────────────

_MODEL_NAME = os.environ.get(
    "EMBEDDING_MODEL_NAME",
    "sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
)
_model: Optional[SentenceTransformer] = None
_supabase: Optional[Client] = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(_MODEL_NAME)
    return _model


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_KEY"]
        _supabase = create_client(url, key)
    return _supabase


# ── Intent → Category mapping ─────────────────────────────────────────────────

INTENT_CATEGORY_MAP = {
    "SF_SOIL":        "soil_fertility",
    "SF_PREP":        "biofertiliser",
    "SF_APPLY":       "biofertiliser",
    "DIAG_SYMPTOM":   "pest_disease",
    "DIAG_DISEASE":   "pest_disease",
    "DIAG_PEST":      "pest_disease",
    "CROP_INFO":      "crop_info",
    "LOCATION_INFO":  "location_info",
    "ORGANIC_INPUT":  "organic_farming",
    "GENERAL":        None,  # no filter
}


# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class NLPResult:
    """
    Minimal contract between M2 NLP and M3 RAG.
    The NLP module produces this; RAG consumes it.
    """
    enriched_query: str
    intent: str = "GENERAL"
    crop: Optional[str] = None
    zone_id: Optional[int] = None
    entities: dict = field(default_factory=dict)


@dataclass
class RAGChunk:
    content: str
    source_doc: str
    source_page: int
    category: str
    similarity: float
    tier: int = 1
    crop_tag: Optional[str] = None
    zone_tag: Optional[str] = None

    def citation(self) -> str:
        """Return a formatted citation string for this chunk."""
        page_str = f", p.{self.source_page}" if self.source_page else ""
        return f"[{self.source_doc}{page_str}]"


# ── Core Retrieval Function ───────────────────────────────────────────────────

def retrieve(nlp_result: NLPResult, top_k: int = None) -> list[RAGChunk]:
    """
    Embed the enriched query, call Supabase match_chunks RPC,
    and return a ranked list of RAGChunk objects.

    Args:
        nlp_result: NLPResult from the NLP/intent module.
        top_k:      Override RAG_TOP_K env var if provided.

    Returns:
        List of RAGChunk sorted by similarity descending.
    """
    if top_k is None:
        top_k = int(os.environ.get("RAG_TOP_K", 5))

    threshold = float(os.environ.get("RAG_SIMILARITY_THRESHOLD", 0.60))

    model = _get_model()
    sb = _get_supabase()

    # 1. Embed the enriched query
    embedding = model.encode(
        nlp_result.enriched_query,
        normalize_embeddings=True,
    ).tolist()

    # 2. Determine category filter from intent
    category_filter = INTENT_CATEGORY_MAP.get(nlp_result.intent, None)

    # 3. Build RPC params
    rpc_params = {
        "query_embedding": embedding,
        "match_threshold": threshold,
        "match_count": top_k,
    }
    if category_filter:
        rpc_params["filter_category"] = category_filter
    if nlp_result.crop:
        rpc_params["filter_crop"] = nlp_result.crop

    # 4. Call Supabase match_chunks RPC
    try:
        result = sb.rpc("match_chunks", rpc_params).execute()
        rows = result.data or []
    except Exception as e:
        print(f"[RAG] match_chunks RPC error: {e}")
        # Fallback: retry without filters
        fallback_params = {
            "query_embedding": embedding,
            "match_threshold": threshold,
            "match_count": top_k,
        }
        result = sb.rpc("match_chunks", fallback_params).execute()
        rows = result.data or []

    # 5. Convert to RAGChunk objects, sort by similarity desc
    chunks = [
        RAGChunk(
            content=row.get("content", ""),
            source_doc=row.get("source_doc", ""),
            source_page=row.get("source_page", 0),
            category=row.get("category", ""),
            similarity=float(row.get("similarity", 0.0)),
            crop_tag=row.get("crop_tag"),
            zone_tag=row.get("zone_tag"),
        )
        for row in rows
    ]
    chunks.sort(key=lambda c: c.similarity, reverse=True)
    return chunks


# ── Convenience: format chunks for LLM context ───────────────────────────────

def format_chunks_for_context(chunks: list[RAGChunk], max_chars: int = 3000) -> str:
    """
    Format retrieved chunks into a context string for the LLM prompt.
    Respects max_chars budget.
    """
    parts = []
    total = 0
    for i, chunk in enumerate(chunks, 1):
        block = f"[{i}] {chunk.citation()}\n{chunk.content}\n"
        if total + len(block) > max_chars:
            break
        parts.append(block)
        total += len(block)
    return "\n".join(parts)


# ── Quick smoke test ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    test = NLPResult(
        enriched_query="jeevamrutha preparation cow dung ingredients Karnataka",
        intent="SF_PREP",
        crop=None,
    )
    results = retrieve(test)
    print(f"Retrieved {len(results)} chunks:\n")
    for c in results:
        print(f"  {round(c.similarity, 3)}  {c.citation()}")
        print(f"  {c.content[:120]}...\n")
