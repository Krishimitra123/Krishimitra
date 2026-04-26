"""
Module M7 — Knowledge Ingestion Pipeline
Responsibility: Ingest knowledge from multiple sources into Supabase pgvector.
Supports: JSON seed data, PDF books, YouTube transcripts, manual curation.

This is the ETL backbone of KrishiMitra — all knowledge flows through here.
"""

import json
import os
import re
from typing import Optional
from sentence_transformers import SentenceTransformer
from supabase import create_client

MODEL_NAME = os.environ.get('EMBEDDING_MODEL_NAME',
             'sentence-transformers/paraphrase-multilingual-mpnet-base-v2')

_model = None
_client = None


def _ensure_loaded():
    """Lazy-load embedding model and Supabase client."""
    global _model, _client
    if _model is None:
        print('[M7] Loading embedding model...')
        _model = SentenceTransformer(MODEL_NAME)
        print(f'[M7] Model loaded: {MODEL_NAME}')
    if _client is None:
        url = os.environ.get('SUPABASE_URL', '')
        key = os.environ.get('SUPABASE_SERVICE_KEY', '')
        if url and key:
            _client = create_client(url, key)
            print('[M7] Supabase client ready')
        else:
            print('[M7] WARNING: Supabase not configured')


def _chunk_text(text: str, max_tokens: int = 512, overlap: int = 50) -> list[str]:
    """
    Split text into overlapping chunks of roughly max_tokens words.
    Uses sentence boundaries to avoid cutting mid-sentence.
    """
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    chunks = []
    current_chunk = []
    current_len = 0

    for sentence in sentences:
        word_count = len(sentence.split())
        if current_len + word_count > max_tokens and current_chunk:
            chunks.append(' '.join(current_chunk))
            # Keep last N words for overlap
            overlap_text = ' '.join(current_chunk[-2:]) if len(current_chunk) > 2 else ''
            current_chunk = [overlap_text] if overlap_text else []
            current_len = len(overlap_text.split())
        current_chunk.append(sentence)
        current_len += word_count

    if current_chunk:
        chunks.append(' '.join(current_chunk))

    return chunks


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts using the multilingual model."""
    _ensure_loaded()
    embeddings = _model.encode(texts, normalize_embeddings=True, show_progress_bar=True)
    return [e.tolist() for e in embeddings]


async def ingest_seed_chunks(json_path: str) -> dict:
    """
    Ingest curated seed knowledge chunks from a JSON file.
    Each chunk is already pre-written by domain experts.

    Args:
        json_path: Path to JSON file with chunk array

    Returns:
        { 'chunks_created': int, 'status': str }
    """
    _ensure_loaded()

    if _client is None:
        return {'chunks_created': 0, 'status': 'error', 'error': 'Supabase not configured'}

    with open(json_path, 'r') as f:
        chunks = json.load(f)

    print(f'[M7] Ingesting {len(chunks)} seed chunks from {json_path}')

    # Extract texts and embed them all at once
    texts = [c['content'] for c in chunks]
    embeddings = embed_texts(texts)

    # Insert into Supabase
    inserted = 0
    for chunk, embedding in zip(chunks, embeddings):
        try:
            _client.table('chunks').insert({
                'content': chunk['content'],
                'embedding': embedding,
                'source_doc': chunk['source_doc'],
                'source_page': chunk.get('source_page'),
                'category': chunk['category'],
                'sub_category': chunk.get('sub_category'),
                'crop_tag': chunk.get('crop_tag'),
                'zone_tag': chunk.get('zone_tag'),
                'language': chunk.get('language', 'en'),
                'verified': chunk.get('verified', False),
            }).execute()
            inserted += 1
        except Exception as e:
            print(f'[M7] Insert failed for chunk: {str(e)[:100]}')

    print(f'[M7] Ingested {inserted}/{len(chunks)} chunks')
    return {'chunks_created': inserted, 'status': 'success'}


async def ingest_pdf(
    pdf_path: str,
    source_doc: str,
    category: str,
    sub_category: Optional[str] = None,
    crop_tag: Optional[str] = None,
    zone_tag: Optional[int] = None,
    language: str = 'en',
) -> dict:
    """
    Ingest a PDF book into the RAG knowledge base.

    1. Extract text from PDF using PyMuPDF
    2. Split into 512-token overlapping chunks
    3. Embed each chunk
    4. Store in Supabase with metadata

    Args:
        pdf_path: Path to PDF file
        source_doc: Human-readable source name
        category: RAG category slug
        sub_category: Optional sub-category
        crop_tag: Optional crop filter
        zone_tag: Optional Karnataka agro-zone (1-10)
        language: 'en' or 'kn'

    Returns:
        { 'chunks_created': int, 'pages_processed': int, 'status': str }
    """
    _ensure_loaded()

    if _client is None:
        return {'chunks_created': 0, 'pages_processed': 0, 'status': 'error',
                'error': 'Supabase not configured'}

    try:
        import fitz  # PyMuPDF
    except ImportError:
        return {'chunks_created': 0, 'pages_processed': 0, 'status': 'error',
                'error': 'PyMuPDF not installed. Run: pip install pymupdf'}

    print(f'[M7] Processing PDF: {pdf_path}')
    doc = fitz.open(pdf_path)
    all_chunks = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text().strip()
        if len(text) < 50:
            continue  # Skip near-empty pages

        page_chunks = _chunk_text(text, max_tokens=512)
        for chunk_text in page_chunks:
            if len(chunk_text.split()) < 20:
                continue  # Skip tiny fragments
            all_chunks.append({
                'content': chunk_text,
                'source_page': page_num + 1,
            })

    doc.close()
    print(f'[M7] Extracted {len(all_chunks)} chunks from {len(doc)} pages')

    if not all_chunks:
        return {'chunks_created': 0, 'pages_processed': len(doc), 'status': 'empty'}

    # Embed all chunks
    texts = [c['content'] for c in all_chunks]
    embeddings = embed_texts(texts)

    # Insert into Supabase
    inserted = 0
    for chunk, embedding in zip(all_chunks, embeddings):
        try:
            _client.table('chunks').insert({
                'content': chunk['content'],
                'embedding': embedding,
                'source_doc': source_doc,
                'source_page': chunk['source_page'],
                'category': category,
                'sub_category': sub_category,
                'crop_tag': crop_tag,
                'zone_tag': zone_tag,
                'language': language,
                'verified': False,
            }).execute()
            inserted += 1
        except Exception as e:
            print(f'[M7] Insert failed: {str(e)[:100]}')

    print(f'[M7] PDF ingestion complete: {inserted}/{len(all_chunks)} chunks')
    return {
        'chunks_created': inserted,
        'pages_processed': len(doc) if hasattr(doc, '__len__') else 0,
        'status': 'success',
    }


async def ingest_youtube_transcript(
    video_url: str,
    source_doc: str,
    category: str,
    sub_category: Optional[str] = None,
    language: str = 'en',
) -> dict:
    """
    Ingest a YouTube video transcript into RAG knowledge base.

    1. Extract transcript using youtube_transcript_api
    2. Chunk the transcript
    3. Embed and store

    Args:
        video_url: YouTube video URL
        source_doc: Human-readable source name
        category: RAG category slug
    """
    _ensure_loaded()

    if _client is None:
        return {'chunks_created': 0, 'status': 'error', 'error': 'Supabase not configured'}

    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        return {'chunks_created': 0, 'status': 'error',
                'error': 'youtube_transcript_api not installed. Run: pip install youtube-transcript-api'}

    # Extract video ID
    video_id = None
    if 'v=' in video_url:
        video_id = video_url.split('v=')[1].split('&')[0]
    elif 'youtu.be/' in video_url:
        video_id = video_url.split('youtu.be/')[1].split('?')[0]

    if not video_id:
        return {'chunks_created': 0, 'status': 'error', 'error': 'Invalid YouTube URL'}

    print(f'[M7] Fetching transcript for video: {video_id}')

    try:
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['en', 'kn', 'hi'])
    except Exception as e:
        return {'chunks_created': 0, 'status': 'error', 'error': f'Transcript fetch failed: {e}'}

    # Combine transcript segments into full text
    full_text = ' '.join([seg['text'] for seg in transcript_list])
    print(f'[M7] Transcript: {len(full_text)} chars')

    # Chunk the transcript
    chunks = _chunk_text(full_text, max_tokens=512)
    if not chunks:
        return {'chunks_created': 0, 'status': 'empty'}

    # Embed and store
    embeddings = embed_texts(chunks)
    inserted = 0

    for chunk_text, embedding in zip(chunks, embeddings):
        if len(chunk_text.split()) < 15:
            continue
        try:
            _client.table('chunks').insert({
                'content': chunk_text,
                'embedding': embedding,
                'source_doc': source_doc,
                'source_url': video_url,
                'category': category,
                'sub_category': sub_category,
                'language': language,
                'verified': False,
            }).execute()
            inserted += 1
        except Exception as e:
            print(f'[M7] Insert failed: {str(e)[:100]}')

    print(f'[M7] YouTube ingestion complete: {inserted} chunks')
    return {'chunks_created': inserted, 'status': 'success'}


async def ingest_manual_chunks(chunks_data: list[dict]) -> dict:
    """
    Ingest manually curated chunks from API request body.
    Each dict must have: content, source_doc, category.
    Optional: sub_category, crop_tag, zone_tag, source_page, language.
    """
    _ensure_loaded()

    if _client is None:
        return {'chunks_created': 0, 'status': 'error', 'error': 'Supabase not configured'}

    texts = [c['content'] for c in chunks_data]
    embeddings = embed_texts(texts)

    inserted = 0
    for chunk, embedding in zip(chunks_data, embeddings):
        try:
            _client.table('chunks').insert({
                'content': chunk['content'],
                'embedding': embedding,
                'source_doc': chunk['source_doc'],
                'source_page': chunk.get('source_page'),
                'category': chunk['category'],
                'sub_category': chunk.get('sub_category'),
                'crop_tag': chunk.get('crop_tag'),
                'zone_tag': chunk.get('zone_tag'),
                'language': chunk.get('language', 'en'),
                'verified': chunk.get('verified', False),
            }).execute()
            inserted += 1
        except Exception as e:
            print(f'[M7] Insert failed: {str(e)[:100]}')

    return {'chunks_created': inserted, 'status': 'success'}


async def get_corpus_stats() -> dict:
    """Get statistics about the knowledge corpus."""
    _ensure_loaded()

    if _client is None:
        return {'total_chunks': 0, 'categories': {}, 'status': 'not_configured'}

    try:
        result = _client.table('chunks').select('category, sub_category, verified').execute()
        rows = result.data or []

        categories = {}
        verified_count = 0
        for row in rows:
            cat = row['category']
            if cat not in categories:
                categories[cat] = {'total': 0, 'verified': 0, 'sub_categories': set()}
            categories[cat]['total'] += 1
            if row.get('verified'):
                categories[cat]['verified'] += 1
                verified_count += 1
            if row.get('sub_category'):
                categories[cat]['sub_categories'].add(row['sub_category'])

        # Convert sets to lists for JSON
        for cat in categories:
            categories[cat]['sub_categories'] = list(categories[cat]['sub_categories'])

        return {
            'total_chunks': len(rows),
            'verified_chunks': verified_count,
            'categories': categories,
            'status': 'ok',
        }
    except Exception as e:
        return {'total_chunks': 0, 'status': 'error', 'error': str(e)}
