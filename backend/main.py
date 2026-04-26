"""
KrishiMitra API — FastAPI Entry Point
Organic farming AI for Karnataka farmers — Nivetti Systems

Start: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
from pathlib import Path

# Load environment variables before anything else
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env')

from routers import query, diagnose, admin, ingest

app = FastAPI(
    title='KrishiMitra API',
    description='Organic farming AI for Karnataka farmers — Nivetti Systems',
    version='2.0.0',
)

# CORS — allow Expo app
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],       # Restrict in production
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Register routers
app.include_router(query.router)
app.include_router(diagnose.router)
app.include_router(admin.router)
app.include_router(ingest.router)


@app.get('/health')
async def health_check():
    """GET /health — Simple health check endpoint."""
    return {
        'status': 'ok',
        'version': '2.0.0',
        'app': 'KrishiMitra by Nivetti Systems',
        'modules': ['M1-Voice', 'M2-NLP', 'M3-RAG', 'M4-Vision', 'M5-Response', 'M6-Guard', 'M7-Ingest'],
    }


@app.on_event('startup')
async def startup_event():
    """Pre-load sentence transformer model to prevent cold-start latency."""
    model_name = os.environ.get('EMBEDDING_MODEL_NAME',
                                'sentence-transformers/paraphrase-multilingual-mpnet-base-v2')
    print(f'[KrishiMitra] Starting up...')
    print(f'[KrishiMitra] Embedding model: {model_name}')
    print(f'[KrishiMitra] Environment: {os.environ.get("ENVIRONMENT", "development")}')

    # Lazy-load the RAG model on first request to avoid blocking startup
    # when Supabase isn't configured yet (development mode)
    try:
        from modules.m3_rag import _ensure_loaded
        _ensure_loaded()
        print(f'[KrishiMitra] RAG model loaded successfully')
    except Exception as e:
        print(f'[KrishiMitra] RAG model deferred: {e}')

    print(f'[KrishiMitra] Server ready')
