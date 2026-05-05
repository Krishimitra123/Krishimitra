# High-Level Design (HLD)
## KrishiMitra — System Architecture Document
**Document ID:** KM-HLD-001 | **Version:** 2.0 | **Date:** 2026-05-05  
**Author:** Mohammed Shakeeb | **Organization:** Nivetti Systems

---

## 1. System Context (C4 Level 1)

```mermaid
graph TB
    subgraph "Users"
        FARMER["🧑‍🌾 Karnataka Farmer<br/>(Mobile App)"]
        ADMIN["👨‍💻 Admin<br/>(API Client)"]
    end

    subgraph "KrishiMitra System"
        MOBILE["📱 Mobile App<br/>(Expo/React Native)"]
        BACKEND["⚙️ Backend API<br/>(FastAPI/Python)"]
        DB["🗄️ Database<br/>(Supabase/pgvector)"]
    end

    subgraph "External Services"
        SARVAM["🎙️ Sarvam AI<br/>(STT/TTS)"]
        MISTRAL["🤖 Mistral AI<br/>(LLM)"]
        PIXTRAL["📸 Pixtral-12b<br/>(Vision AI)"]
        OPENMETEO["🌦️ Open-Meteo<br/>(Weather)"]
        SOILGRIDS["🌍 SoilGrids<br/>(Soil Data)"]
        DATAGOV["📊 Data.gov.in<br/>(Market Prices)"]
    end

    FARMER --> MOBILE
    ADMIN --> BACKEND
    MOBILE --> BACKEND
    BACKEND --> DB
    BACKEND --> SARVAM
    BACKEND --> MISTRAL
    BACKEND --> PIXTRAL
    BACKEND --> OPENMETEO
    BACKEND --> SOILGRIDS
    BACKEND --> DATAGOV
```

## 2. Container Diagram (C4 Level 2)

```mermaid
graph TB
    subgraph "Mobile (Expo/React Native)"
        TABS["Tab Navigator<br/>(Home, Chat, Diagnose, History)"]
        SERVICES["Service Layer<br/>(api, query, voice, diagnosis,<br/>weather, market, soil)"]
        STORES["State Stores<br/>(Zustand: User, Session, Audio)"]
    end

    subgraph "Backend (FastAPI)"
        ROUTERS["API Routers<br/>(query, diagnose, admin,<br/>weather, soil, market)"]
        MODULES["Processing Modules<br/>(M1-Voice, M2-NLP, M3-RAG,<br/>M4-Diagnosis, M5-Response,<br/>M6-Guard, M7-Ingest)"]
        MODELS["Data Models<br/>(Pydantic Schemas)"]
    end

    subgraph "Data Layer"
        SUPA["Supabase PostgreSQL<br/>+ pgvector extension"]
        CORPUS["Structured Corpus<br/>(JSON files)"]
    end

    TABS --> SERVICES --> STORES
    SERVICES -->|"HTTP/JSON"| ROUTERS
    ROUTERS --> MODULES
    MODULES --> MODELS
    MODULES --> SUPA
    MODULES --> CORPUS
```

## 3. Technology Stack Rationale

| Layer | Technology | Why Chosen | Alternatives Considered |
|-------|-----------|-----------|------------------------|
| **Mobile** | Expo/React Native | Cross-platform, rapid iteration, Expo Go for testing | Flutter (steeper learning curve), Native (2x dev time) |
| **Backend** | FastAPI (Python) | Async support, auto-docs, ML ecosystem compatibility | Node.js (weaker ML), Django (slower async) |
| **Database** | Supabase + pgvector | Free tier, PostgreSQL power, vector search built-in | Pinecone (costly), Weaviate (complex self-host) |
| **Voice STT** | Sarvam AI | Best Kannada accuracy, Indian language specialist | Google STT (poor Kannada), Whisper (needs GPU) |
| **Voice TTS** | Sarvam Bulbul v3 | Natural Kannada voice, 22kHz quality | Google TTS (robotic), Azure (expensive) |
| **LLM** | Mistral Small | Cost-effective, good multilingual, fast inference | GPT-4 (expensive), Gemini (quota issues) |
| **Vision** | Pixtral-12b | Strong plant image classification, good JSON output | Gemini Vision (quota), GPT-4V (expensive) |
| **Embeddings** | sentence-transformers/paraphrase-multilingual-mpnet-base-v2 | Multilingual, 768-dim, Kannada-English cross-lingual | OpenAI embeddings (API cost per call) |
| **State Mgmt** | Zustand | Lightweight, no boilerplate, AsyncStorage persistence | Redux (verbose), Context API (re-render issues) |
| **Weather** | Open-Meteo | Free, no key, agriculture data, global coverage | OpenWeatherMap (1K/day limit), Visual Crossing |
| **Soil** | SoilGrids ISRIC | Free, 250m resolution, comprehensive properties | ISRO Bhuvan (complex), Soil Health Card (no API) |
| **Market** | Data.gov.in + curated | Official government data, free API | Agmarknet (no API), private APIs (cost) |

## 4. Data Flow — Voice Query Pipeline

```mermaid
sequenceDiagram
    participant F as 📱 Farmer
    participant M as 📱 Mobile App
    participant B as ⚙️ Backend
    participant S as 🎙️ Sarvam STT
    participant R as 🗄️ RAG/pgvector
    participant L as 🤖 Mistral LLM
    participant G as 🛡️ Guard
    participant T as 🔊 Sarvam TTS

    F->>M: Press mic, speak Kannada
    M->>M: Record audio (M4A/WAV)
    M->>B: POST /api/query {audio_base64}
    B->>S: STT: audio → text (15s timeout)
    S-->>B: Kannada transcript
    B->>B: M2: Intent classify (SF_PREP, SF_APPLY...)
    B->>R: M3: Embed query → pgvector search
    R-->>B: Top-5 chunks (similarity > 0.60)
    B->>L: M5: Synthesize response (Kannada)
    L-->>B: Draft response
    B->>G: M6: Verify claims vs RAG chunks
    G-->>B: Confidence score + filtered response
    B->>T: TTS: text → audio (22kHz WAV)
    T-->>B: Audio base64
    B-->>M: {answer_text_kn, audio_base64, sources}
    M->>F: Display text + auto-play audio
```

## 5. Data Flow — Disease Diagnosis Pipeline

```mermaid
sequenceDiagram
    participant F as 📱 Farmer
    participant M as 📱 Mobile App
    participant B as ⚙️ Backend
    participant P as 📸 Pixtral-12b
    participant R as 🗄️ RAG
    participant T as 🔊 TTS

    F->>M: Capture/pick crop photo
    M->>B: POST /api/diagnose {image_base64}
    B->>B: Compress image (800px, 85% quality)
    B->>P: Vision analysis (JSON schema prompt)
    P-->>B: {disease, symptoms, treatments...}
    B->>B: Chemical filter check
    B->>R: Cross-reference disease in RAG
    B->>T: Synthesize Kannada summary → TTS
    T-->>B: Audio
    B-->>M: {diagnosis, audio, sources}
    M->>F: Display diagnosis card + play audio
```

## 6. Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        DEV_MOBILE["📱 Expo Dev Client<br/>(localhost:8081)"]
        DEV_BACKEND["⚙️ uvicorn<br/>(localhost:8000)"]
    end

    subgraph "Production"
        PROD_MOBILE["📱 EAS Build<br/>(Android APK/AAB)"]
        PROD_BACKEND["⚙️ Railway/Render<br/>(Docker container)"]
        PROD_DB["🗄️ Supabase<br/>(Managed PostgreSQL)"]
    end

    subgraph "External (Always Remote)"
        EXT["Sarvam AI, Mistral AI,<br/>Open-Meteo, SoilGrids,<br/>Data.gov.in"]
    end

    DEV_MOBILE --> DEV_BACKEND --> PROD_DB
    PROD_MOBILE --> PROD_BACKEND --> PROD_DB
    DEV_BACKEND --> EXT
    PROD_BACKEND --> EXT
```

## 7. Network & Security Architecture

| Concern | Implementation |
|---------|---------------|
| **API Keys** | Server-side only (.env), never sent to client |
| **CORS** | Configured for mobile app origin (restrict in production) |
| **Input Validation** | Pydantic schemas on all endpoints |
| **Chemical Block** | Hard filter in M4_confidence_guard + M5_response |
| **Timeout Protection** | 45s hard cap on full pipeline, 15s per external call |
| **Data Privacy** | Farmer profile stored on-device only (AsyncStorage), not on server |
| **Audio Cleanup** | Temporary audio files deleted after processing |
| **Rate Limiting** | External API caching (1hr weather, 24hr soil, 6hr market) |
