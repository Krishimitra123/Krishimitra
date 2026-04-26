# KrishiMitra v2.0 — PRD & FRD

> **Nivetti Systems** | Voice-First Organic Agriculture AI for Karnataka Farmers
> Based on CEO directives & domain expert guidance

---

## 1. Executive Summary

KrishiMitra is NOT an LLM wrapper. It is a **domain-specific, RAG-grounded, Voice-AI agricultural assistant** that delivers verified organic farming knowledge to Karnataka's farmers in Kannada. The LLM acts only as a translator and synthesiser — **all knowledge originates from authenticated, curated sources**.

### CEO Directives (Non-Negotiable)
1. **Deep tech stack** — not a ChatGPT wrapper
2. **Hallucination prevention** — every answer from verified RAG corpus
3. **Curated knowledge sources** — Vruksha Ayurveda, Subhash Palekar ZBNF, expert YouTube
4. **Category focus** — Soil Fertility first, done excellently before expanding
5. **Voice AI for plant health** — authenticate virus-free, healthy plants, root development
6. **India's cow-based agriculture** — Jeevamrutha, Gau Krupa Amrutha, vermicompost from cow dung

---

## 2. Product Vision

### 2.1 Problem Statement
- 300M+ Indian cattle heads; less than 5% dung/urine used for organic fertiliser
- Chemical fertiliser (Urea) is imported — supply chain risk for India
- Farmers lack accessible, verified guidance on organic alternatives
- Existing apps are LLM wrappers that hallucinate agricultural advice

### 2.2 Solution
A **Voice-first Kannada AI assistant** that:
- Delivers **only verified, source-cited organic farming knowledge**
- Focuses on **soil fertility** as the foundation of all agriculture
- Uses **computer vision** to verify plant health and diagnose diseases
- Speaks back in **clear Kannada audio** for low-literacy farmers

### 2.3 Golden Rule
> **AI = Translator + Synthesiser, NOT Knowledge Source.**
> Every answer must trace back to a RAG chunk from an authenticated source.

---

## 3. Knowledge Architecture (Deep Tech — NOT a Wrapper)

### 3.1 Knowledge Pyramid

```
+-------------------------------------------+
|    M5: LLM Response Layer                 |  <- Synthesise + Translate ONLY
|    (Gemini - NO raw knowledge)            |
+-------------------------------------------+
|    M3: RAG Retrieval Engine               |  <- Vector similarity search
|    (pgvector + sentence-transformers)     |
+-------------------------------------------+
|    Knowledge Ingestion Pipeline           |  <- ETL from curated sources
|    (PDF extract -> chunk -> embed -> store)|
+-------------------------------------------+
|    Authenticated Source Corpus            |  <- THE source of truth
|    Books | Research Papers | Expert Video |
+-------------------------------------------+
```

### 3.2 Authenticated Knowledge Sources

#### Tier 1: Core Books (Phase 1 — Soil Fertility)

| Source | Author | Focus | Priority |
|--------|--------|-------|----------|
| **Vruksha Ayurveda** | Traditional (Surapala) | Ancient plant science, soil biology | P0 |
| **Zero Budget Natural Farming** | Subhash Palekar | Jeevamrutha, Bijamrutha, Mulching | P0 |
| **The One-Straw Revolution** | Masanobu Fukuoka | Natural farming philosophy | P1 |
| **ICAR Organic Farming Manuals** | ICAR/UAS Bangalore | Karnataka-specific practices | P1 |
| **KVK Best Practices** | Krishi Vigyan Kendras | District-level recommendations | P1 |

#### Tier 2: Expert YouTube Channels (Phase 1)

| Channel / Expert | Content Type | Extraction Method |
|-----------------|--------------|-------------------|
| Subhash Palekar lectures | ZBNF techniques | YouTube transcript -> chunk |
| Organic farming KN channels | Kannada demonstrations | Whisper STT -> translate -> chunk |
| UAS Dharwad / UAS Bangalore | Research presentations | Manual curation + transcript |

#### Tier 3: Research & Government (Phase 2+)

| Source | Content |
|--------|---------|
| NPOP Standards | Organic certification requirements |
| APEDA Guidelines | Export-grade organic standards |
| Soil Health Card Data | District-wise soil profiles |

### 3.3 RAG Categories (Supabase `chunks` Table)

| Category Slug | Scope | Phase |
|---------------|-------|-------|
| `soil_fertility` | Mulching, organic matter, soil biology | **Phase 1** |
| `biofertiliser` | Jeevamrutha, Gau Krupa Amrutha, Kunapa Jala, Vermicompost | **Phase 1** |
| `pest_disease` | Organic pest management, neem-based solutions | Phase 2 |
| `crop_advice` | Crop-specific cultivation practices | Phase 2 |
| `certification` | NPOP, PGS-India, APEDA organic certification | Phase 3 |
| `market_linkage` | Organic market access, FPO info | Phase 3 |

---

## 4. Phase 1 Focus: Soil Fertility (Do One Thing Excellently)

### 4.1 Sub-Module: Mulching (`soil_fertility`)

| Topic | Key Content | Source |
|-------|-------------|--------|
| **Green Leaf Manure** | Gliricidia, Sesbania, Crotalaria | Palekar ZBNF |
| **Nugge (Moringa)** | Leaf mulch, nutrient profile, application rate | Vruksha Ayurveda |
| **Agase (Flax/Sesbania)** | N-fixing, biomass per acre, decomposition time | ICAR manuals |
| **Gliricidia** | Hedge planting, lopping schedule, C:N ratio | UAS Bangalore |
| **In-situ mulching** | Crop residue management, stubble incorporation | Palekar ZBNF |
| **Living mulch** | Cover crops between rows, weed suppression | Research papers |

### 4.2 Sub-Module: Organic Fertilisers (`biofertiliser`)

| Preparation | Ingredients | Process | Source |
|-------------|------------|---------|--------|
| **Jeevamrutha** | Cow dung (10kg), cow urine (10L), jaggery (2kg), pulse flour (2kg), handful of soil, 200L water | Ferment 48hrs, apply within 7 days | Palekar ZBNF Ch.3 |
| **Bijamrutha** | Cow dung (5kg), cow urine (5L), lime (50g), handful of soil, 20L water | Seed treatment before sowing | Palekar ZBNF Ch.2 |
| **Gau Krupa Amrutha** | Enhanced Jeevamrutha with specific herbal additions | 72hr fermentation | Traditional |
| **Kunapa Jala** (vegetarian) | Neem cake, castor cake, groundnut cake, jaggery, cow dung, water | 30-day fermentation | Vruksha Ayurveda |
| **Vermicompost** | Cow dung + Eisenia fetida worms | 45-60 day process, moisture 60-70% | ICAR Manual |
| **Panchagavya** | 5 cow products: dung, urine, milk, curd, ghee | 21-day preparation | Traditional |

### 4.3 Scientific Foundation (NOT Superstition)

Key scientific principles to encode in RAG chunks:

1. **Soil Biology** — Cow gut bacteria (Lactobacillus, Bacillus, Azotobacter) colonise soil and fix nitrogen
2. **Microbial Inoculant** — Jeevamrutha = concentrated microbial culture, NOT just fertiliser
3. **C:N Ratio** — Mulch materials maintain 25:1 ratio for optimal decomposition
4. **Soil Food Web** — Bacteria -> Protozoa -> Nematodes -> Earthworms -> Nutrient cycling
5. **Chemical vs Biological** — Urea kills soil microbiome; organic inputs feed it

---

## 5. System Architecture (Deep Tech Stack)

### 5.1 Module Breakdown

| Module | Current State | v2.0 Enhancement |
|--------|--------------|------------------|
| **M1: Voice** | Sarvam STT/TTS basic | 22kHz TTS, noise filtering, dialect support |
| **M2: NLP** | Keyword-based intent | ML classifier (scikit-learn) trained on farming intents |
| **M3: RAG** | pgvector basic search | Category-filtered, source-weighted, freshness scoring |
| **M4: Vision** | Gemini disease detection | Multi-stage: health verify -> disease detect -> severity |
| **M5: Response** | Gemini raw synthesis | Constrained generation with source citation enforcement |
| **M6: Guard** | *(NEW)* | Hallucination detector — cross-check LLM vs RAG chunks |
| **M7: Ingest** | Basic PDF chunker | Multi-source pipeline: PDF + YouTube + manual curation |

### 5.2 NEW Module: M6 Hallucination Guard

Cross-checks every LLM-generated statement against RAG source chunks.
- Split response into claims
- Embed each claim, check similarity against RAG chunks
- Flag ungrounded claims, return only grounded content + citations

### 5.3 NEW Module: M7 Knowledge Ingestion Pipeline

```
Source -> Extract -> Clean -> Chunk -> Embed -> Store -> Validate

PDF Book  --> PyMuPDF extract --> Clean/Normalize --> 512-token chunks
YouTube   --> yt-dlp + Whisper --> Translate to EN --> 512-token chunks
Manual    --> Expert curated   --> JSON format     --> 512-token chunks
                                                        |
                                                        v
                                             sentence-transformers embed
                                                        |
                                                        v
                                             Supabase pgvector INSERT
                                                        |
                                                        v
                                             Validation: test queries
```

---

## 6. Voice AI for Plant Health Verification

### 6.1 Vision Pipeline (M4 Enhanced)

```
Photo Input
    |
    v
Stage 1: Quality Assessment
    Is the image clear enough?
    -> If not: voice prompt in Kannada
    |  (pass)
    v
Stage 2: Health Classification
    Is the plant healthy or diseased?
    -> Healthy: voice report on leaf/root health
    |  (diseased)
    v
Stage 3: Disease Identification
    What disease? What severity?
    -> RAG lookup for organic treatment
    |
    v
Stage 4: Voice Response (TTS)
    Speak treatment in clear Kannada (22kHz)
    + Source citation
```

### 6.2 Healthy Plant Report Example

> **Voice (Kannada):** "Your crop is growing healthily. Leaves are green, no disease symptoms visible. Root development appears normal."

---

## 7. Database Schema (Supabase)

### 7.1 `chunks` Table (pgvector)

```sql
CREATE TABLE chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content         TEXT NOT NULL,
    embedding       VECTOR(768),
    source_doc      TEXT NOT NULL,
    source_page     INT,
    source_url      TEXT,
    category        TEXT NOT NULL,
    sub_category    TEXT,
    crop_tag        TEXT,
    zone_tag        INT,
    language        TEXT DEFAULT 'en',
    verified        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding VECTOR(768),
    match_threshold FLOAT,
    match_count INT,
    filter_category TEXT DEFAULT NULL,
    filter_crop TEXT DEFAULT NULL
) RETURNS TABLE (
    id UUID, content TEXT, source_doc TEXT, source_page INT,
    category TEXT, sub_category TEXT, similarity FLOAT
) AS $$
    SELECT id, content, source_doc, source_page, category, sub_category,
           1 - (embedding <=> query_embedding) AS similarity
    FROM chunks
    WHERE (filter_category IS NULL OR category = filter_category)
      AND (filter_crop IS NULL OR crop_tag = filter_crop OR crop_tag IS NULL)
      AND 1 - (embedding <=> query_embedding) > match_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$ LANGUAGE sql;
```

### 7.2 `source_documents` Table

```sql
CREATE TABLE source_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    author          TEXT,
    source_type     TEXT NOT NULL,     -- 'book' | 'youtube' | 'research_paper'
    url             TEXT,
    language        TEXT DEFAULT 'en',
    total_chunks    INT DEFAULT 0,
    ingested_at     TIMESTAMPTZ DEFAULT NOW(),
    verified_by     TEXT,
    notes           TEXT
);
```

---

## 8. API Endpoints (FRD)

### 8.1 Existing (Enhanced)

| Endpoint | Method | Enhancement |
|----------|--------|-------------|
| `/api/query` | POST | Add hallucination guard, source-weighted ranking |
| `/api/diagnose` | POST | Multi-stage pipeline (quality -> health -> disease) |
| `/health` | GET | Add corpus stats, model status |

### 8.2 New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/ingest/pdf` | POST | Ingest PDF book with category tagging |
| `/api/admin/ingest/youtube` | POST | Ingest YouTube transcript |
| `/api/admin/ingest/manual` | POST | Ingest manually curated JSON chunks |
| `/api/admin/corpus/stats` | GET | Chunk counts by category |
| `/api/admin/corpus/search` | POST | Test RAG queries |
| `/api/plant-health` | POST | Dedicated plant health verification |

---

## 9. Mobile App Enhancements

### 9.1 New Screens

| Screen | Purpose |
|--------|---------|
| **Plant Health** | Camera -> instant health report with voice feedback |
| **Knowledge Browser** | Browse soil fertility tips by category |
| **Preparation Guide** | Step-by-step Jeevamrutha/Vermicompost guides with timers |

### 9.2 Offline Capability (Phase 2)

- Cache top-50 most-asked Q&A pairs locally
- Offline Jeevamrutha preparation timer (48hr countdown)
- Offline plant health tips (pre-downloaded)

---

## 10. Phased Delivery Plan

### Phase 1: Soil Fertility Excellence (4 weeks)

| Week | Deliverable |
|------|-------------|
| **W1** | Knowledge ingestion pipeline (M7) — PDF + YouTube extractors |
| **W1** | Curate and ingest Subhash Palekar ZBNF content |
| **W1** | Curate and ingest Vruksha Ayurveda soil sections |
| **W2** | Supabase schema migration + `match_chunks` RPC |
| **W2** | RAG pipeline tested with 20 soil fertility queries |
| **W3** | Hallucination Guard (M6) — cross-check LLM output |
| **W3** | Plant Health verification pipeline (multi-stage vision) |
| **W3** | Voice output optimization (22kHz, clear Kannada) |
| **W4** | Mobile: Preparation Guide screen |
| **W4** | End-to-end testing: voice -> RAG -> voice response |
| **W4** | Benchmark: 50 test queries, measure accuracy |

### Phase 2: Pest & Disease Management (4 weeks)

- Ingest organic pest management content
- Neem-based solutions, Dashparni Ark, etc.
- Enhanced vision pipeline for 20+ common diseases

### Phase 3: Certification & Market (4 weeks)

- NPOP/PGS-India certification guidance
- FPO formation assistance
- Organic market linkage information

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| RAG Accuracy | >85% relevant chunks in top-3 |
| Source Citation | 100% of answers cite source |
| Hallucination Rate | <5% ungrounded claims |
| Voice Clarity | >4.0/5.0 farmer rating |
| Response Time | <8 seconds voice-to-voice |
| Soil Fertility Coverage | 50+ verified chunks |
| Biofertiliser Coverage | 30+ preparation guides |

---

## 12. Technical Decisions

### Why NOT Just an LLM Wrapper

| Wrapper Approach | KrishiMitra Approach |
|-----------------|---------------------|
| "Ask ChatGPT about farming" | Curated RAG from verified books |
| LLM hallucinates dosages | Every number from source document |
| No accountability | Every answer cites page number |
| Generic advice | Karnataka zone + crop + season specific |
| English-first | Kannada-first with Voice AI |

### Chemical Filter (Hard Block)

The system MUST filter out any mention of:
- Urea, DAP, NPK, MOP
- Synthetic pesticides (Endosulfan, Chlorpyrifos, etc.)
- Growth hormones, GM seeds

If LLM mentions any chemical input -> replace with organic alternative from RAG.

---

## 13. Immediate Next Steps

1. **Create Supabase `chunks` table** with the schema from Section 7.1
2. **Write ingestion script** for Subhash Palekar ZBNF content
3. **Curate 20 Jeevamrutha/Mulching text chunks** manually as seed data
4. **Test RAG pipeline** with 10 Kannada soil fertility queries
5. **Get a new Gemini API key** with billing enabled (free tier quota is exhausted)
6. **Test Sarvam API key** for voice I/O

> **WARNING:** The current Gemini API key has exhausted its free-tier daily quota. A new key with billing enabled, or a fresh key from a new project, is required before any further testing.
