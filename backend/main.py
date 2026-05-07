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
from routers import weather, soil, market
from routers import auth
from routers import transcribe
from routers import tts

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

@app.get('/')
async def root():
    """GET / — Welcome message and health check link."""
    return {
        'message': 'Welcome to KrishiMitra API',
        'health': '/health',
        'status': 'online'
    }

# Register routers
app.include_router(query.router)
app.include_router(diagnose.router)
app.include_router(admin.router)
app.include_router(weather.router)
app.include_router(soil.router)
app.include_router(market.router)
app.include_router(auth.router)
app.include_router(transcribe.router)
app.include_router(tts.router)

@app.get('/health')
async def health_check():
    """GET /health — Simple health check endpoint."""
    return {
        'status': 'ok',
        'version': '2.0.0',
        'app': 'KrishiMitra by Nivetti Systems',
        'endpoints': {
            'query': '/api/query',
            'diagnose': '/api/diagnose',
            'weather': '/api/weather',
            'soil': '/api/soil',
            'market': '/api/market',
        }
    }

from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[GlobalError] {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "ನಮಸ್ಕಾರ, ಸರ್ವರ್‌ನಲ್ಲಿ ತಾಂತ್ರಿಕ ದೋಷವಾಗಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಪ್ರಯತ್ನಿಸಿ."},
    )

@app.on_event('startup')
async def startup_event():
    print(f'KrishiMitra backend starting...')
