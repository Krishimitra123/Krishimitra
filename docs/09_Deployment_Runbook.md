# Deployment & Operations Runbook
## KrishiMitra — Setup & Deployment Guide
**Document ID:** KM-DEPLOY-001 | **Version:** 2.0 | **Date:** 2026-05-05

---

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.11+ | Backend runtime |
| Node.js | 18+ | Mobile development |
| npm | 9+ | Package management |
| ffmpeg | 6+ | Audio format conversion |
| Expo CLI | latest | Mobile dev server |
| Git | 2.30+ | Version control |

## 2. Backend Setup

```bash
# 1. Clone and navigate
git clone https://github.com/nivetti/krishimitra.git
cd KrishiMitra/backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux
# or: venv\Scripts\activate  # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env with your actual API keys:
#   SARVAM_API_KEY=your_key
#   GEMINI_API_KEY=your_key  (or MISTRAL_API_KEY)
#   SUPABASE_URL=your_url
#   SUPABASE_SERVICE_KEY=your_key
#   DATA_GOV_API_KEY=your_key  (optional, for live market data)

# 5. Verify ffmpeg
ffmpeg -version  # Should show version 6+

# 6. Start server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 7. Verify
curl http://localhost:8000/health
```

## 3. Mobile Setup

```bash
# 1. Navigate to mobile
cd KrishiMitra/mobile

# 2. Install dependencies
npm install

# 3. Configure environment
echo "EXPO_PUBLIC_API_BASE_URL=http://<your-ip>:8000" > .env

# 4. Start Expo
npx expo start

# 5. Scan QR code with Expo Go app on phone
```

## 4. Supabase Setup

1. Create account at https://supabase.com
2. Create new project
3. Go to SQL Editor
4. Run `krishimitra_supabase_schema.sql` from repo root
5. Copy Project URL and Service Key to `.env`
6. Seed data: run `python backend/scripts/ingest_structured_kb.py`

## 5. Production Deployment

### Backend (Railway/Render)

```bash
# Dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y ffmpeg
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Mobile (EAS Build)

```bash
cd mobile
npx eas build --platform android --profile preview
# Downloads APK for direct installation
```

## 6. Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SARVAM_API_KEY` | Yes | — | Sarvam AI voice services |
| `GEMINI_API_KEY` | Yes* | — | Google Gemini (backup vision) |
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | — | Supabase service role key |
| `EMBEDDING_MODEL_NAME` | No | `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` | Embedding model |
| `RAG_SIMILARITY_THRESHOLD` | No | `0.60` | Minimum similarity for RAG |
| `RAG_TOP_K` | No | `5` | Number of RAG chunks |
| `MAX_RESPONSE_WORDS` | No | `150` | Max response length |
| `DATA_GOV_API_KEY` | No | — | Data.gov.in market API |
| `ENVIRONMENT` | No | `development` | App environment |

## 7. Health Check Verification

```bash
# Backend health
curl http://localhost:8000/health

# Weather API
curl "http://localhost:8000/api/weather?district=Mysuru"

# Soil API
curl "http://localhost:8000/api/soil?district=Kalaburagi"

# Market API
curl "http://localhost:8000/api/market/prices?commodity=Ragi"
```

## 8. Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `ffmpeg not found` | Not installed | `brew install ffmpeg` (macOS) |
| `SQLITE_FULL` on mobile | Audio base64 in AsyncStorage | Already fixed — migration runs on startup |
| `Sarvam timeout` | Network/quota | Check API key, retry |
| `SoilGrids 503` | Server overloaded | Cached data served, retry later |
| `ModuleNotFoundError` | Missing pip install | `pip install -r requirements.txt` |
| Expo tunnel not working | Firewall | Use `--tunnel` flag or localtunnel |
