"""
Corpus Ingestion Pipeline — Run once per new batch of documents.
Usage: python scripts/ingest_corpus.py

Extracts text from PDFs/JSON, chunks them, embeds with sentence-transformers,
and stores in Supabase pgvector for RAG retrieval.
"""

import json
import os
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

try:
    import pdfplumber
    from sentence_transformers import SentenceTransformer
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from supabase import create_client
except ImportError as e:
    print(f'Missing dependency: {e}')
    print('Run: pip install -r requirements.txt')
    sys.exit(1)

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
MODEL_NAME   = os.environ.get('EMBEDDING_MODEL_NAME',
               'sentence-transformers/paraphrase-multilingual-mpnet-base-v2')

# ── Text Splitter Config ─────────────────────────────────────────

splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=50,
    separators=['\n\n', '\n', '. ', '। ', '? ', '! ', ' '],
    # Note: '। ' is the Kannada/Devanagari full stop separator
)

# ── Document Manifest — Update when adding new docs ──────────────

DOCUMENT_MANIFEST = [
    {
        'path': 'corpus/raw/ICAR_Organic_Farming_eCourse.pdf',
        'source_doc': 'ICAR Organic Farming eCourse (agrimoon.com)',
        'category': 'organic_farming',
        'crop_tag': None, 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/raw/ICAR_Soil_Fertility_Nutrient_Management.pdf',
        'source_doc': 'ICAR Soil Fertility & Nutrient Management eCourse',
        'category': 'soil_fertility',
        'crop_tag': None, 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/raw/TNAU_Organic_Farming_2024.pdf',
        'source_doc': 'TNAU Organic Farming E-Book 2024',
        'category': 'organic_farming',
        'crop_tag': None, 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/raw/ZBNF_ResearchGate_2022.pdf',
        'source_doc': 'ZBNF Research Paper 2022 (ResearchGate)',
        'category': 'biofertiliser',
        'crop_tag': None, 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/raw/NCDS_WP70_ZBNF_Karnataka.pdf',
        'source_doc': 'ZBNF Karnataka Working Paper WP70 (NCDS)',
        'category': 'biofertiliser',
        'crop_tag': None, 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/raw/NIPHM_IPM_Rice.pdf',
        'source_doc': 'NIPHM IPM Package — Rice',
        'category': 'pest_disease',
        'crop_tag': 'Paddy', 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/raw/NIPHM_IPM_Tomato.pdf',
        'source_doc': 'NIPHM IPM Package — Tomato',
        'category': 'pest_disease',
        'crop_tag': 'Tomato', 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/raw/NIPHM_IPM_Cotton.pdf',
        'source_doc': 'NIPHM IPM Package — Cotton',
        'category': 'pest_disease',
        'crop_tag': 'Cotton', 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/raw/Chilli.pdf',
        'source_doc': 'NIPHM IPM Package — Chilli',
        'category': 'pest_disease',
        'crop_tag': 'Chilli', 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/raw/Groundnut.pdf',
        'source_doc': 'NIPHM IPM Package — Groundnut',
        'category': 'pest_disease',
        'crop_tag': 'Groundnut', 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/raw/Onion.pdf',
        'source_doc': 'NIPHM IPM Package — Onion',
        'category': 'pest_disease',
        'crop_tag': 'Onion', 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/raw/Banana.pdf',
        'source_doc': 'NIPHM IPM Package — Banana',
        'category': 'pest_disease',
        'crop_tag': 'Banana', 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/structured/karnataka_soil_zones.json',
        'source_doc': 'Karnataka Agro-Climatic Zones Database (internal)',
        'category': 'soil_fertility',
        'crop_tag': None, 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/structured/karnataka_disease_db.json',
        'source_doc': 'Karnataka Crop Disease Database (internal)',
        'category': 'pest_disease',
        'crop_tag': None, 'zone_tag': None, 'language': 'en',
    },
    {
        'path': 'corpus/structured/crop_list.json',
        'source_doc': 'Karnataka Crop List (internal)',
        'category': 'crop_info',
        'crop_tag': None, 'zone_tag': None, 'language': 'en+kn',
    },
    {
        'path': 'corpus/structured/district_list.json',
        'source_doc': 'Karnataka District List (internal)',
        'category': 'location_info',
        'crop_tag': None, 'zone_tag': None, 'language': 'en',
    },
]


# ── Extraction Functions ─────────────────────────────────────────

def extract_text_from_pdf(pdf_path: str) -> list:
    """Extract text from each page of a PDF."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if text and len(text.strip()) > 50:  # skip near-empty pages
                pages.append({'text': text.strip(), 'page': i})
    return pages


def extract_text_from_json(json_path: str) -> list:
    """For structured JSON docs (soil zone data, disease DB, vocab)."""
    data = json.loads(Path(json_path).read_text(encoding='utf-8'))
    if isinstance(data, list):
        chunks = []
        for i, item in enumerate(data):
            chunks.append({
                'text': json.dumps(item, ensure_ascii=False),
                'page': i + 1,
            })
        return chunks
    return [{'text': json.dumps(data, ensure_ascii=False), 'page': 1}]


# ── Main Ingestion Function ──────────────────────────────────────

def ingest_document(doc_config: dict) -> int:
    """
    Ingest a single document into the vector database.
    Returns the number of chunks created.
    """
    path = doc_config['path']
    print(f'Ingesting: {path}')

    # Check if file exists
    if not Path(path).exists():
        print(f'  ⚠ File not found: {path} — skipping')
        return 0

    # Extract text based on file type
    if path.endswith('.pdf'):
        pages = extract_text_from_pdf(path)
    elif path.endswith('.json'):
        pages = extract_text_from_json(path)
    else:
        pages = [{'text': Path(path).read_text(encoding='utf-8'), 'page': 1}]

    # Chunk each page
    all_chunks = []
    for page_data in pages:
        chunks = splitter.split_text(page_data['text'])
        for chunk in chunks:
            if len(chunk.strip()) < 30:
                continue  # skip very short chunks
            all_chunks.append({'text': chunk, 'page': page_data['page']})

    print(f'  → {len(all_chunks)} chunks')

    if not all_chunks:
        return 0

    # Load model and client
    model = SentenceTransformer(MODEL_NAME)
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Embed and store in batches of 32
    BATCH = 32
    total_stored = 0

    for i in range(0, len(all_chunks), BATCH):
        batch = all_chunks[i:i + BATCH]
        texts = [c['text'] for c in batch]
        embeddings = model.encode(texts, normalize_embeddings=True).tolist()

        rows = []
        for j, chunk in enumerate(batch):
            rows.append({
                'content':     chunk['text'],
                'embedding':   embeddings[j],
                'source_doc':  doc_config['source_doc'],
                'source_page': chunk['page'],
                'category':    doc_config['category'],
                'crop_tag':    doc_config.get('crop_tag'),
                'zone_tag':    doc_config.get('zone_tag'),
                'language':    doc_config.get('language', 'en'),
            })

        supabase.table('document_chunks').insert(rows).execute()
        total_stored += len(rows)
        print(f'  → Stored batch {i // BATCH + 1} ({total_stored} total)')

    return total_stored


if __name__ == '__main__':
    if not SUPABASE_URL or not SUPABASE_KEY:
        print('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env')
        sys.exit(1)

    total = 0
    for doc in DOCUMENT_MANIFEST:
        count = ingest_document(doc)
        total += count

    print(f'\n✅ Ingestion complete. Total chunks stored: {total}')
