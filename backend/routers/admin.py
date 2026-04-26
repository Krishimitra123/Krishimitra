"""
Admin Router — Internal document ingestion endpoint.
POST /api/admin/ingest — Not exposed to farmers.
"""

from fastapi import APIRouter
from models.schemas import IngestRequest, IngestResponse
from pathlib import Path
import json

router = APIRouter(prefix='/api/admin', tags=['admin'])


@router.post('/ingest', response_model=IngestResponse)
async def ingest_endpoint(request: IngestRequest):
    """
    POST /api/admin/ingest
    
    Ingest a new document into the RAG knowledge base.
    Internal use only — not exposed to farmers.
    
    Input: { pdf_url, category, language, source_doc, crop_tag, zone_tag }
    Output: { chunks_created, embeddings_stored, status }
    """
    try:
        from scripts.ingest_corpus import ingest_document

        doc_config = {
            'path': request.pdf_url,
            'source_doc': request.source_doc,
            'category': request.category,
            'crop_tag': request.crop_tag,
            'zone_tag': request.zone_tag,
            'language': request.language,
        }

        chunks_count = ingest_document(doc_config)

        return IngestResponse(
            chunks_created=chunks_count,
            embeddings_stored=chunks_count,
            status='success',
        )

    except Exception as e:
        return IngestResponse(
            chunks_created=0,
            embeddings_stored=0,
            status='error',
            error=str(e),
        )


@router.get('/stats')
async def corpus_stats():
    """Get current corpus statistics."""
    return {
        'status': 'ok',
        'message': 'Connect Supabase to get live stats',
    }
