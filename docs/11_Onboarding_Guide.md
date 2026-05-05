# Developer Onboarding Guide
## KrishiMitra — New Team Member Handbook
**Document ID:** KM-ONBOARD-001 | **Version:** 2.0 | **Date:** 2026-05-05

---

## Day 1: Setup & Architecture

### 1.1 Environment Setup
Follow `docs/09_Deployment_Runbook.md` to set up:
- [ ] Clone repository
- [ ] Backend: Python venv + requirements + .env
- [ ] Mobile: npm install + .env
- [ ] Start both servers, verify `/health`
- [ ] Install ffmpeg for audio processing

### 1.2 Understand the Architecture
Read these docs in order:
1. `CONTEXT.md` — Quick 8-module overview (10 min)
2. `docs/02_HLD.md` — System architecture with diagrams (20 min)
3. `docs/06_ADR.md` — Why we made each technology choice (15 min)

### 1.3 Project Structure

```
KrishiMitra/
├── backend/
│   ├── main.py              ← FastAPI entry point
│   ├── routers/              ← API endpoints (query, diagnose, weather, soil, market)
│   ├── modules/              ← Business logic (M1-M7)
│   ├── models/               ← Pydantic schemas
│   ├── corpus/structured/    ← Knowledge base JSONs
│   └── scripts/              ← Utility scripts (benchmark, ingest)
├── mobile/
│   ├── app/                  ← Screens (Expo Router file-based routing)
│   ├── components/           ← Shared UI components
│   ├── services/             ← API client + domain services
│   ├── stores/               ← Zustand state management
│   └── constants/            ← Theme, districts, crops
├── docs/                     ← All documentation (you are here)
└── krishimitra_supabase_schema.sql  ← Database schema
```

---

## Day 2: Deep Dive into Modules

### 2.1 Core Pipeline Flow
```
User speaks → M1 (STT) → M2 (Intent) → M3 (RAG) → M5 (LLM) → M6 (Guard) → M1 (TTS) → User hears
```

### 2.2 Module Ownership Map

| Module | File | What It Does | Key Function |
|--------|------|-------------|-------------|
| M1 Voice | `m1_voice.py` | Audio ↔ text conversion | `stt_transcribe()`, `tts_synthesize()` |
| M2 NLP | `m2_intent.py` | Query intent classification | `classify_intent()` |
| M3 RAG | `m3_rag.py` | Vector search against corpus | `retrieve()` |
| M4 Diagnosis | `m4_diagnosis.py` | Plant disease identification | `diagnose()` |
| M5 Response | `m5_response.py` | LLM response synthesis | `generate()` |
| M6 Guard | `m6_guard.py` | Hallucination prevention | `verify()` |
| M7 Ingest | `m7_ingest.py` | Knowledge corpus ingestion | `ingest_pdf()` |

### 2.3 Critical Rules (MUST READ)
1. **Chemical filter is absolute** — Never let Urea/DAP/NPK appear in responses
2. **All farmer-facing text in Kannada** — English only for logs/admin
3. **RAG threshold 0.60** — Below this = redirect to KVK, never guess
4. **45-second hard timeout** — Pipeline must complete or fail gracefully
5. **Audio cleanup** — Delete temp files after processing

---

## Day 3: Make Your First Change

### 3.1 Suggested First Tasks (pick one)
- Add a new crop to `mobile/constants/crops.ts`
- Add a new test query to `backend/scripts/benchmark_rag.py`
- Add a new organic input to `backend/corpus/structured/organic_inputs.json`
- Fix a Kannada typo in any screen

### 3.2 Development Workflow
```bash
# 1. Create feature branch
git checkout dev
git pull
git checkout -b feature/your-name-feature

# 2. Make changes, test locally

# 3. Commit with proper message
git add .
git commit -m "feat: add new crop variety to onboarding list"

# 4. Push and create PR
git push origin feature/your-name-feature
# Create PR from feature branch → dev
```

### 3.3 Code Review Checklist
- [ ] No API keys or secrets in code
- [ ] Kannada text is correct (ask native speaker if unsure)
- [ ] Error handling for network failures
- [ ] Timeouts set for external API calls
- [ ] Chemical filter not bypassed

---

## Domain Knowledge Primer

### Zero Budget Natural Farming (ZBNF)
Founded by Subhash Palekar. Core principle: use only farm-produced inputs (no external chemicals). Key preparations:
- **Jeevamrutha**: Cow dung + urine + jaggery + flour + soil → ferment 48hrs
- **Beejamrutha**: Seed treatment with cow dung/urine mixture
- **Panchagavya**: 5 cow products fermented for enhanced plant growth

### Karnataka Agriculture
- 31 districts, 10 agro-climatic zones
- Major crops: Ragi, Paddy, Jowar, Cotton, Groundnut, Coffee, Areca Nut
- Soil types: Black (Vertisol) in north, Red (laterite) in south, Coastal alluvial

### Key Acronyms
| Acronym | Meaning |
|---------|---------|
| ZBNF | Zero Budget Natural Farming |
| KVK | Krishi Vigyan Kendra (agri extension center) |
| APMC | Agricultural Produce Market Committee |
| ICAR | Indian Council of Agricultural Research |
| NIPHM | National Institute of Plant Health Management |
| RAG | Retrieval-Augmented Generation |
| STT/TTS | Speech-to-Text / Text-to-Speech |

---

## FAQ for New Developers

**Q: Why not use GPT-4?**  
A: Cost. Mistral Small is free-tier and fast enough. See ADR-001.

**Q: Why is the RAG threshold 0.60 and not higher?**  
A: Kannada↔English cross-lingual retrieval naturally scores lower than same-language queries. 0.60 is tuned for acceptable precision without losing too many valid queries.

**Q: Can I test without Sarvam/Mistral API keys?**  
A: You can test weather/soil/market endpoints (no keys needed). For full pipeline testing, you need at minimum SARVAM_API_KEY.

**Q: The app shows "ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ" — what's wrong?**  
A: Backend is unreachable. Check: (1) uvicorn running? (2) EXPO_PUBLIC_API_BASE_URL correct? (3) Same network?
