-- ============================================================
-- KrishiMitra v2.0 — Supabase Schema Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Source Documents Table ──────────────────────────────────────
-- Tracks provenance of every knowledge source
CREATE TABLE IF NOT EXISTS source_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    author          TEXT,
    source_type     TEXT NOT NULL CHECK (source_type IN ('book', 'youtube', 'research_paper', 'manual', 'government')),
    url             TEXT,
    language        TEXT DEFAULT 'en',
    total_chunks    INT DEFAULT 0,
    ingested_at     TIMESTAMPTZ DEFAULT NOW(),
    verified_by     TEXT,
    notes           TEXT
);

-- ── Knowledge Chunks Table (pgvector) ──────────────────────────
-- Core RAG table — every chunk is a verified piece of knowledge
CREATE TABLE IF NOT EXISTS chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content         TEXT NOT NULL,
    embedding       VECTOR(768),
    source_doc      TEXT NOT NULL,
    source_page     INT,
    source_url      TEXT,
    category        TEXT NOT NULL CHECK (category IN (
        'soil_fertility', 'biofertiliser', 'pest_disease',
        'crop_advice', 'certification', 'market_linkage'
    )),
    sub_category    TEXT,
    crop_tag        TEXT,
    zone_tag        INT CHECK (zone_tag IS NULL OR (zone_tag >= 1 AND zone_tag <= 10)),
    language        TEXT DEFAULT 'en',
    verified        BOOLEAN DEFAULT FALSE,
    source_doc_id   UUID REFERENCES source_documents(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
    ON chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS chunks_category_idx ON chunks (category);
CREATE INDEX IF NOT EXISTS chunks_crop_tag_idx ON chunks (crop_tag);

-- ── Match Chunks RPC Function ──────────────────────────────────
-- Called by M3 RAG engine for similarity search
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding VECTOR(768),
    match_threshold FLOAT,
    match_count INT,
    filter_category TEXT DEFAULT NULL,
    filter_crop TEXT DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    content TEXT,
    source_doc TEXT,
    source_page INT,
    category TEXT,
    sub_category TEXT,
    similarity FLOAT
) AS $$
    SELECT
        c.id,
        c.content,
        c.source_doc,
        c.source_page,
        c.category,
        c.sub_category,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM chunks c
    WHERE (filter_category IS NULL OR c.category = filter_category)
      AND (filter_crop IS NULL OR c.crop_tag = filter_crop OR c.crop_tag IS NULL)
      AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
$$ LANGUAGE sql;

-- ── Insert Seed Source Documents ────────────────────────────────
INSERT INTO source_documents (title, author, source_type, language, notes) VALUES
    ('Zero Budget Natural Farming', 'Subhash Palekar', 'book', 'en', 'Core ZBNF reference — Jeevamrutha, Bijamrutha, Mulching, Four Wheels'),
    ('Vruksha Ayurveda', 'Surapala (translated by Nalini Sadhale)', 'book', 'en', 'Ancient Indian plant science — soil classification, Kunapa Jala, plant nutrition'),
    ('UAS Bangalore - Organic Farming Guides', 'University of Agricultural Sciences, Bangalore', 'research_paper', 'en', 'Karnataka-specific organic practices, Gliricidia, zone-wise recommendations'),
    ('UAS Dharwad - Green Manuring Guide', 'University of Agricultural Sciences, Dharwad', 'research_paper', 'en', 'Sesbania/Agase green manuring for Northern Karnataka'),
    ('ICAR Organic Farming Manual', 'Indian Council of Agricultural Research', 'government', 'en', 'Vermicompost production, organic certification standards'),
    ('TNAU Organic Farming Guide', 'Tamil Nadu Agricultural University', 'research_paper', 'en', 'Panchagavya preparation and application'),
    ('Traditional Karnataka Organic Practices', 'Community knowledge compilation', 'manual', 'en', 'Gau Krupa Amrutha, traditional preparations'),
    ('NITI Aayog Natural Farming Report', 'Government of India', 'government', 'en', 'Policy analysis, economics of natural vs chemical farming')
ON CONFLICT DO NOTHING;
