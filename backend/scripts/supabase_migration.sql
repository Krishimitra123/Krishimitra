-- KrishiMitra v3.0 Supabase Schema Migration
-- Run this script in the Supabase SQL Editor

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Structured Knowledge Base (SKB) Tables
CREATE TABLE IF NOT EXISTS organic_inputs (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_kn TEXT NOT NULL,
    transliteration TEXT,
    synonyms_kn JSONB,
    category TEXT NOT NULL,
    primary_action TEXT NOT NULL,
    ingredients JSONB NOT NULL,
    preparation_steps JSONB NOT NULL,
    fermentation_days INT,
    application_rate JSONB,
    application_method TEXT,
    timing TEXT,
    cow_requirements TEXT,
    critical_warnings JSONB,
    common_mistakes JSONB,
    primary_source TEXT NOT NULL,
    secondary_sources JSONB,
    confidence_level TEXT NOT NULL DEFAULT 'single_source',
    soil_triad_effect JSONB,
    microbial_content JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mulching_plants (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_kn TEXT NOT NULL,
    botanical TEXT,
    n_fixed_kg_ha_yr INT,
    lop_height_cm INT,
    lop_frequency_weeks INT,
    biomass_decomposition_weeks INT,
    planting_density JSONB,
    soil_triad_effect JSONB,
    additional_benefits JSONB,
    karnataka_zones JSONB,
    planting_season TEXT,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Vector RAG Table
CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding VECTOR(768) NOT NULL,
    source_doc TEXT NOT NULL,
    source_page INT,
    category TEXT NOT NULL,
    crop_tag TEXT,
    zone_tag INT,
    language TEXT DEFAULT 'en',
    tier INT DEFAULT 1,
    is_youtube BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW Index for fast vector similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Match chunks RPC for vector search
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding VECTOR(768),
    match_threshold FLOAT,
    match_count INT,
    filter_category TEXT DEFAULT NULL,
    filter_crop TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    content TEXT,
    source_doc TEXT,
    source_page INT,
    category TEXT,
    similarity FLOAT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        dc.id,
        dc.content,
        dc.source_doc,
        dc.source_page,
        dc.category,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM document_chunks dc
    WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
      AND (filter_category IS NULL OR dc.category = filter_category)
      AND (filter_crop IS NULL OR dc.crop_tag = filter_crop)
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- 4. Knowledge Graph Relationship Tables
CREATE TABLE IF NOT EXISTS symptom_deficiency_links (
    id SERIAL PRIMARY KEY,
    symptom_name TEXT,
    deficiency_name TEXT,
    probability FLOAT
);

CREATE TABLE IF NOT EXISTS deficiency_correction_links (
    id SERIAL PRIMARY KEY,
    deficiency_name TEXT,
    organic_input_id TEXT,
    effectiveness TEXT
);

CREATE TABLE IF NOT EXISTS zone_deficiency_links (
    id SERIAL PRIMARY KEY,
    zone_id INT,
    deficiency_name TEXT,
    prevalence_pct INT
);

CREATE TABLE IF NOT EXISTS crop_input_links (
    id SERIAL PRIMARY KEY,
    crop_name TEXT,
    organic_input_id TEXT,
    benefit_description TEXT
);
