# KrishiMitra — Development Context File
> **Purpose**: Single source of truth for AI-assisted development. Read this first to avoid re-scanning the entire codebase.

## Project Summary
- **What**: Voice-first, Kannada-primary AI assistant for Karnataka organic farmers
- **Stack**: FastAPI (Python backend) + React Native/Expo (mobile) + Supabase pgvector (RAG DB)
- **Golden Rule**: AI = Translator + Synthesiser, NOT Knowledge Source. Every answer from RAG corpus.
- **Branding**: Nivetti Systems
- **Version**: 2.0.0

## Architecture: 8 Modules
| Module | File | Responsibility |
|--------|------|----------------|
| M1 | `backend/modules/m1_voice.py` | Voice STT/TTS via Sarvam AI (22kHz) |
| M2 | `backend/modules/m2_nlp.py` | NLP, intent classification, entity extraction |
| M3 | `backend/modules/m3_rag.py` | RAG engine — pgvector similarity search |
| M4 | `backend/modules/m4_diagnosis.py` | Crop image diagnosis via Gemini Vision |
| M5 | `backend/modules/m5_response.py` | Response generation — Gemini LLM + safety filters |
| M6 | `backend/modules/m6_guard.py` | **Hallucination Guard** — cross-check LLM vs RAG |
| M7 | `backend/modules/m7_ingest.py` | **Knowledge Ingestion** — PDF, YouTube, manual curation |
| M8 | `mobile/` | React Native / Expo app shell |

## Key API Endpoints
- `POST /api/query` — Main farmer query (voice/text/image)
- `POST /api/diagnose` — Crop disease diagnosis
- `POST /api/admin/ingest` — Document ingestion (legacy)
- `POST /api/admin/ingest/seed` — Ingest seed JSON chunks
- `POST /api/admin/ingest/pdf` — Ingest PDF book
- `POST /api/admin/ingest/youtube` — Ingest YouTube transcript
- `POST /api/admin/ingest/manual` — Ingest curated chunks
- `GET /api/admin/corpus/stats` — Knowledge corpus statistics
- `POST /api/admin/corpus/search` — Test RAG query
- `GET /health` — Health check

## Knowledge Sources (Phase 1: Soil Fertility)
- **Subhash Palekar ZBNF** — Jeevamrutha, Bijamrutha, Mulching, Four Wheels
- **Vruksha Ayurveda (Surapala)** — Traditional plant science, Kunapa Jala
- **UAS Bangalore/Dharwad** — Karnataka-specific organic practices
- **ICAR Manuals** — Vermicompost, organic certification
- **Expert YouTube** — Transcripts from verified agricultural experts

## RAG Categories
| Category | Sub-categories |
|----------|---------------|
| `soil_fertility` | mulching, soil_biology, zbnf_overview, zone_specific, soil_testing, economics, traditional_knowledge |
| `biofertiliser` | jeevamrutha, bijamrutha, gau_krupa_amrutha, kunapa_jala, vermicompost, panchagavya, cow_science |
| `pest_disease` | botanical_pesticide |
| `crop_advice` | ragi, (more to come) |
| `certification` | (Phase 3) |
| `market_linkage` | (Phase 3) |

## File Structure Status
```
krishimitra/
├── CONTEXT.md              ✅ This file
├── docs/
│   └── PRD_FRD_KrishiMitra_v2.md  ✅ Full PRD/FRD
├── backend/
│   ├── main.py             ✅ FastAPI entry point (v2.0.0)
│   ├── requirements.txt    ✅ Python dependencies
│   ├── .env.example        ✅ Environment template
│   ├── routers/
│   │   ├── query.py        ✅ /api/query endpoints
│   │   ├── diagnose.py     ✅ /api/diagnose endpoint
│   │   ├── admin.py        ✅ /api/admin/ingest (legacy)
│   │   └── ingest.py       ✅ /api/admin/ingest/* (v2.0)
│   ├── modules/
│   │   ├── m1_voice.py     ✅ Sarvam STT/TTS (22kHz)
│   │   ├── m2_nlp.py       ✅ NLP pipeline
│   │   ├── m3_rag.py       ✅ RAG retrieval
│   │   ├── m4_diagnosis.py ✅ Gemini Vision diagnosis
│   │   ├── m5_response.py  ✅ Response generation + M6 integration
│   │   ├── m6_guard.py     ✅ Hallucination Guard + Chemical Filter
│   │   └── m7_ingest.py    ✅ Knowledge Ingestion Pipeline
│   ├── models/
│   │   └── schemas.py      ✅ Pydantic models
│   ├── corpus/
│   │   ├── seed_chunks.json     ✅ 20 curated seed chunks
│   │   ├── raw/                 📁 PDF storage (git-ignored)
│   │   ├── text/                📁 Extracted text
│   │   ├── vocab_glossary.json  ✅ Kannada vocab lookup
│   │   ├── district_list.json   ✅ 31 Karnataka districts
│   │   └── crop_list.json       ✅ 60+ crop varieties
│   └── scripts/
│       ├── supabase_migration.sql  ✅ DB schema + RPC functions
│       ├── ingest_corpus.py        ✅ Vector DB builder
│       └── benchmark_rag.py        ✅ RAG accuracy test
│
├── mobile/                  # React Native / Expo
│   ├── app/
│   │   ├── _layout.tsx      ✅ Root layout
│   │   ├── onboarding.tsx   ✅ First-launch onboarding
│   │   └── (tabs)/
│   │       ├── _layout.tsx  ✅ Tab navigator
│   │       ├── index.tsx    ✅ Home screen
│   │       ├── chat.tsx     ✅ Chat screen
│   │       ├── diagnose.tsx ✅ Diagnosis screen
│   │       └── history.tsx  ✅ Session history
│   ├── components/          ✅ MicButton, ChatBubble, etc.
│   ├── stores/              ✅ Zustand (User, Session, Audio)
│   ├── services/            ✅ API layer
│   └── constants/           ✅ Theme, Districts, Crops
```

## Environment Variables Required
### Backend (.env)
- `SARVAM_API_KEY` — Sarvam AI for STT/TTS
- `GEMINI_API_KEY` — Google Gemini for LLM + Vision
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_KEY` — Supabase service role key
- `EMBEDDING_MODEL_NAME` — sentence-transformers model
- `RAG_SIMILARITY_THRESHOLD` — 0.60 default
- `RAG_TOP_K` — 5 default

### Mobile (.env)
- `EXPO_PUBLIC_API_BASE_URL` — Backend URL

## Critical Rules
1. **No chemical inputs ever** — Filter urea, DAP, NPK, chemical pesticides from ALL outputs
2. **RAG threshold 0.60** — Below this → KVK redirect message
3. **150 word limit** — All responses for voice delivery
4. **Kannada primary** — All farmer-facing text in Kannada
5. **Source citation mandatory** — Every answer must cite source
6. **Hallucination Guard** — M6 cross-checks every LLM output against RAG

## Current Sprint Status
- [x] Backend foundation (main.py, schemas, routers)
- [x] M1 Voice module (22kHz TTS)
- [x] M2 NLP module
- [x] M3 RAG module
- [x] M4 Diagnosis module
- [x] M5 Response module (with M6 integration)
- [x] M6 Hallucination Guard
- [x] M7 Knowledge Ingestion Pipeline
- [x] Corpus seed data (20 verified chunks)
- [x] Supabase migration SQL
- [x] Ingestion API endpoints
- [x] Mobile app (all screens + components + stores + services)
- [ ] Run Supabase migration
- [ ] Ingest seed chunks into DB
- [ ] E2E test with fresh Gemini API key

