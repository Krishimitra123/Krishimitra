"""
Ingestion Router — Admin endpoints for knowledge base management.
POST /api/admin/ingest/seed     — Ingest seed JSON chunks
POST /api/admin/ingest/pdf      — Ingest PDF book
POST /api/admin/ingest/youtube  — Ingest YouTube transcript
POST /api/admin/ingest/manual   — Ingest manually curated chunks
GET  /api/admin/corpus/stats    — Knowledge corpus statistics
POST /api/admin/corpus/search   — Test RAG query (dev tool)
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from modules import m7_ingest, m3_rag
from models.schemas import NLPResult, Intent
import os

router = APIRouter(prefix='/api/admin', tags=['admin-ingest'])


# ── Request Models ─────────────────────────────────────────────

class SeedIngestRequest(BaseModel):
    json_path: str = 'corpus/seed_chunks.json'


class PDFIngestRequest(BaseModel):
    pdf_path: str
    source_doc: str
    category: str
    sub_category: Optional[str] = None
    crop_tag: Optional[str] = None
    zone_tag: Optional[int] = None
    language: str = 'en'


class YouTubeIngestRequest(BaseModel):
    video_url: str
    source_doc: str
    category: str
    sub_category: Optional[str] = None
    language: str = 'en'


class ManualChunk(BaseModel):
    content: str
    source_doc: str
    category: str
    sub_category: Optional[str] = None
    crop_tag: Optional[str] = None
    zone_tag: Optional[int] = None
    source_page: Optional[int] = None
    language: str = 'en'
    verified: bool = False


class ManualIngestRequest(BaseModel):
    chunks: list[ManualChunk]


class RAGSearchRequest(BaseModel):
    query: str
    category: Optional[str] = None
    crop: Optional[str] = None
    top_k: int = 5


# ── Endpoints ──────────────────────────────────────────────────

@router.post('/ingest/seed')
async def ingest_seed(request: SeedIngestRequest):
    """Ingest curated seed knowledge chunks from JSON file."""
    result = await m7_ingest.ingest_seed_chunks(request.json_path)
    return result


@router.post('/ingest/pdf')
async def ingest_pdf(request: PDFIngestRequest):
    """Ingest a PDF book into the RAG knowledge base."""
    result = await m7_ingest.ingest_pdf(
        pdf_path=request.pdf_path,
        source_doc=request.source_doc,
        category=request.category,
        sub_category=request.sub_category,
        crop_tag=request.crop_tag,
        zone_tag=request.zone_tag,
        language=request.language,
    )
    return result


@router.post('/ingest/youtube')
async def ingest_youtube(request: YouTubeIngestRequest):
    """Ingest a YouTube video transcript into the knowledge base."""
    result = await m7_ingest.ingest_youtube_transcript(
        video_url=request.video_url,
        source_doc=request.source_doc,
        category=request.category,
        sub_category=request.sub_category,
        language=request.language,
    )
    return result


@router.post('/ingest/manual')
async def ingest_manual(request: ManualIngestRequest):
    """Ingest manually curated knowledge chunks."""
    chunks_data = [c.model_dump() for c in request.chunks]
    result = await m7_ingest.ingest_manual_chunks(chunks_data)
    return result


@router.get('/corpus/stats')
async def corpus_stats():
    """Get statistics about the knowledge corpus."""
    return await m7_ingest.get_corpus_stats()


@router.post('/corpus/search')
async def corpus_search(request: RAGSearchRequest):
    """Test RAG search query — development tool."""
    # Build a mock NLPResult for the search
    nlp_result = NLPResult(
        raw_transcript=request.query,
        normalised_query=request.query,
        detected_language='en',
        intent=Intent.GENERAL,
        confidence=1.0,
        enriched_query=request.query,
        routing=['rag'],
    )

    # Override category filter if specified
    if request.category:
        intent_map = {
            'soil_fertility': Intent.SOIL_QUERY,
            'biofertiliser': Intent.BIOFERTILISER,
            'pest_disease': Intent.PEST_DISEASE,
            'certification': Intent.CERTIFICATION,
        }
        nlp_result.intent = intent_map.get(request.category, Intent.GENERAL)

    if request.crop:
        nlp_result.entities = {'crop_name': request.crop}

    chunks = await m3_rag.retrieve(nlp_result)
    return {
        'query': request.query,
        'results': [c.to_dict() for c in chunks],
        'count': len(chunks),
    }
