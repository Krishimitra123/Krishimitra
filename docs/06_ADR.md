# Architecture Decision Records (ADR)
## KrishiMitra — Technical Decision Log
**Document ID:** KM-ADR-001 | **Version:** 2.0 | **Date:** 2026-05-05  
**Author:** Mohammed Shakeeb | **Organization:** Nivetti Systems

---

## ADR-001: Mistral AI over GPT-4 for Response Generation

**Status:** Accepted | **Date:** 2026-04-20

**Context:** Need an LLM for synthesizing Kannada farming responses from RAG chunks. Options: GPT-4 (OpenAI), Gemini (Google), Mistral Small.

**Decision:** Mistral Small via REST API.

**Rationale:**
- Free tier available with generous limits
- Good multilingual support including Indic languages
- JSON mode for structured outputs
- Lower latency than GPT-4 (2-4s vs 5-8s)
- REST API doesn't require heavy SDK

**Consequences:**
- ✅ Cost-effective for Phase 1
- ✅ Fast inference for mobile users
- ⚠️ Slightly lower Kannada quality than GPT-4 (mitigated by detailed system prompt)

---

## ADR-002: Sarvam AI over Google STT/Whisper for Kannada Voice

**Status:** Accepted | **Date:** 2026-04-20

**Context:** Need speech-to-text and text-to-speech for Kannada. Options: Google Cloud STT, OpenAI Whisper, Sarvam AI.

**Decision:** Sarvam AI for both STT and TTS.

**Rationale:**
- Purpose-built for Indian languages — highest Kannada accuracy
- Bulbul v3 TTS produces natural, farmer-friendly Kannada voice
- 22kHz audio quality (crisp)
- Simple REST API integration
- Competitive free tier

**Consequences:**
- ✅ Best-in-class Kannada voice quality
- ✅ Single vendor for both STT+TTS
- ⚠️ Vendor lock-in for voice services

---

## ADR-003: Supabase pgvector over Pinecone/Weaviate

**Status:** Accepted | **Date:** 2026-04-20

**Context:** Need a vector database for RAG. Options: Pinecone (managed), Weaviate (self-hosted), Supabase pgvector.

**Decision:** Supabase with pgvector extension.

**Rationale:**
- Free tier with generous limits
- PostgreSQL = relational + vector in one database
- Structured KB tables (organic_inputs, etc.) live alongside vector data
- HNSW index for fast approximate nearest neighbor search
- RPC functions for custom similarity queries
- Team familiarity with SQL

**Consequences:**
- ✅ Single database for all data needs
- ✅ Zero additional infrastructure cost
- ⚠️ Not as fast as Pinecone for very large datasets (>1M vectors)

---

## ADR-004: Sentence-Transformers over OpenAI Embeddings

**Status:** Accepted | **Date:** 2026-04-20

**Context:** Need embedding model for RAG. Options: OpenAI text-embedding-3, Cohere embed, sentence-transformers local.

**Decision:** `paraphrase-multilingual-mpnet-base-v2` (local, 768-dim).

**Rationale:**
- Free (runs locally, no API cost per embedding)
- Excellent multilingual support — Kannada ↔ English cross-lingual retrieval
- 768 dimensions is a good balance of quality vs storage
- No API dependency for embedding generation
- Model size manageable for server deployment

**Consequences:**
- ✅ Zero marginal cost for embeddings
- ✅ Works offline
- ⚠️ Requires ~1GB RAM for model loading at startup

---

## ADR-005: Pixtral-12b over Gemini Vision for Disease Diagnosis

**Status:** Accepted | **Date:** 2026-04-28

**Context:** Need vision AI for plant disease identification. Started with Gemini Vision, switched to Pixtral-12b.

**Decision:** Pixtral-12b (Mistral's vision model).

**Rationale:**
- Gemini API keys exhausted free-tier quota
- Pixtral produces clean JSON output for disease diagnosis
- 1000 max_tokens sufficient for detailed Kannada diagnosis
- Consistent structured output (disease name, symptoms, treatments)

**Consequences:**
- ✅ Reliable structured output
- ✅ Same vendor as LLM (Mistral) — simpler key management
- ⚠️ Requires image compression before sending (800px, 85% quality)

---

## ADR-006: Expo/React Native over Flutter

**Status:** Accepted | **Date:** 2026-04-20

**Context:** Need cross-platform mobile app. Options: Flutter, React Native (Expo), Native (Kotlin/Swift).

**Decision:** Expo (React Native).

**Rationale:**
- Team has JavaScript/TypeScript experience
- Expo Go enables instant testing without build
- expo-av for audio recording, expo-image-picker for camera
- OTA updates without app store submission
- File-based routing (expo-router) for rapid development

**Consequences:**
- ✅ Fastest development cycle
- ✅ Hot reload for UI iteration
- ⚠️ Some native APIs require dev builds (not Expo Go)

---

## ADR-007: Zustand over Redux for State Management

**Status:** Accepted | **Date:** 2026-04-20

**Context:** Need state management for user profile, session history, audio state.

**Decision:** Zustand with AsyncStorage persistence middleware.

**Rationale:**
- Zero boilerplate (no actions, reducers, dispatchers)
- Built-in persistence with `persist` middleware
- `partialize` function to exclude audio_base64 from storage (fixed SQLITE_FULL bug)
- Direct getState() access from non-React code (API interceptor)

**Consequences:**
- ✅ Minimal code for maximum functionality
- ✅ AsyncStorage persistence is automatic
- ⚠️ No Redux DevTools (acceptable tradeoff)

---

## ADR-008: RAG-First Architecture over Pure LLM

**Status:** Accepted | **Date:** 2026-04-20

**Context:** Design philosophy — should the AI generate responses from training data or from a curated corpus?

**Decision:** RAG-first. The AI acts as a "Translator and Synthesiser" only, never generating knowledge from parametric memory.

**Rationale:**
- Agriculture advice must be verifiable and source-cited
- Pure LLM can hallucinate dangerous farming practices
- RAG enables source attribution (ICAR, NIPHM, Palekar)
- Corpus can be updated without retraining
- Chemical input filter is more reliable when responses are grounded

**Consequences:**
- ✅ Every response is traceable to verified source
- ✅ Chemical contamination risk eliminated
- ⚠️ Corpus size limits knowledge breadth (mitigated by KVK redirect)

---

## ADR-009: Chemical Input Hard-Block over Soft-Warning

**Status:** Accepted | **Date:** 2026-04-20

**Context:** When an LLM response mentions chemical inputs (Urea, DAP, pesticides), should we warn or block?

**Decision:** Hard block. Zero tolerance. Response is rejected and user is redirected to KVK.

**Rationale:**
- KrishiMitra is an *organic* farming tool — any chemical suggestion undermines trust
- Farmers may not distinguish between soft warnings and recommendations
- Hard block ensures 100% organic compliance
- Blocklist includes 13+ chemicals: Urea, DAP, NPK, Ammonium, Chlorpyrifos, etc.

---

## ADR-012: Open-Meteo for Weather API

**Status:** Accepted | **Date:** 2026-05-05

**Context:** Need weather data for Karnataka farmers. Options: OpenWeatherMap, Visual Crossing, Open-Meteo, WeatherAPI.com.

**Decision:** Open-Meteo as primary weather provider.

**Rationale:**
- Completely free, no API key required
- Unlimited requests for non-commercial use
- Includes agriculture-specific data (soil temperature, moisture, evapotranspiration)
- 7-day forecast + historical data
- Global coverage with good India resolution

---

## ADR-013: SoilGrids ISRIC for Soil Data

**Status:** Accepted | **Date:** 2026-05-05

**Context:** Need soil property data. Options: SoilGrids, ISRO Bhuvan, Soil Health Card portal.

**Decision:** SoilGrids ISRIC REST API + local Karnataka zone data.

**Rationale:**
- Free, no API key, 250m resolution globally
- Returns pH, nitrogen, organic carbon, clay/sand/silt percentages
- Combined with our curated `karnataka_soil_zones.json` for zone-specific deficiencies and recommendations
- Soil Health Card portal has no REST API; ISRO Bhuvan is complex to integrate

---

## ADR-014: Curated JSON + Data.gov.in for Market Prices

**Status:** Accepted | **Date:** 2026-05-05

**Context:** Need Karnataka mandi prices. Data.gov.in API key takes 3 days for approval.

**Decision:** Curated Karnataka mandi prices (JSON) as immediate source, with Data.gov.in API as upgrade path.

**Rationale:**
- Deadline is May 7 — cannot wait for API key approval
- Curated data covers 15 major crops across 20+ districts
- Backend code structured to auto-switch to live API when `DATA_GOV_API_KEY` is set
- Prices sourced from public APMC/Agmarknet records
