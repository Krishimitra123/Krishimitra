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

from routers import query, diagnose, admin

app = FastAPI(
    title='KrishiMitra API',
    description='Organic farming AI for Karnataka farmers — Nivetti Systems',
    version='1.0.0',
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

@app.get('/health')
async def health_check():
    """GET /health — Simple health check endpoint."""
    return {
        'status': 'ok',
        'version': '1.0.0',
        'app': 'KrishiMitra by Nivetti Systems',
    }

@app.on_event('startup')
async def startup_event():
    print(f'KrishiMitra backend starting...')
