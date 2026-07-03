-- ============================================================
-- KrishiMitra v2.0 — Resumed Supabase Database Setup
-- Paste this entire script into your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Run)
-- ============================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop reference and user tables to ensure clean schemas
DROP TABLE IF EXISTS disease_db CASCADE;
DROP TABLE IF EXISTS district_list CASCADE;
DROP TABLE IF EXISTS crop_list CASCADE;
DROP TABLE IF EXISTS symptom_deficiency_data CASCADE;
DROP TABLE IF EXISTS karnataka_soil_zones CASCADE;
DROP TABLE IF EXISTS mulching_plants CASCADE;
DROP TABLE IF EXISTS organic_inputs CASCADE;
DROP TABLE IF EXISTS farm_events CASCADE;
DROP TABLE IF EXISTS farmer_crops CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 2. Profiles Table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    farmer_name TEXT NOT NULL,
    phone_number TEXT UNIQUE,
    district TEXT NOT NULL,
    state TEXT DEFAULT 'Karnataka',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Farmer Crops Table
CREATE TABLE IF NOT EXISTS farmer_crops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    crop_name TEXT NOT NULL,
    sowing_date DATE,
    acreage FLOAT,
    status TEXT DEFAULT 'active', -- active, harvested
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Farm Events / Activity Log Table
CREATE TABLE IF NOT EXISTS farm_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- watering, fertilizer, harvest, warning, disease
    crop_name TEXT,
    event_details TEXT,
    event_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RAG Document Chunks Table
CREATE TABLE IF NOT EXISTS document_chunks (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_doc    TEXT        NOT NULL,           -- e.g. 'ICAR Organic Farming eCourse'
    source_page   INT,                            -- page number if available
    chunk_index   INT,                            -- sequential index within document
    content       TEXT        NOT NULL,
    embedding     VECTOR(768) NOT NULL,
    category      TEXT        NOT NULL,           -- biofertiliser|soil|pest|crop|certification|...
    crop_tag      TEXT,                           -- if chunk is crop-specific (nullable)
    zone_tag      INT,                            -- Karnataka zone 1-10, null if general (nullable)
    language      TEXT        NOT NULL,           -- en | kn | mixed
    tier          INT                             -- relevance tier/ranking
);

-- HNSW Vector Index for similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_document_chunks_category ON document_chunks (category);
CREATE INDEX IF NOT EXISTS idx_document_chunks_crop ON document_chunks (crop_tag);

-- Drop the function first to prevent default value definition conflicts
DROP FUNCTION IF EXISTS match_chunks(vector(768),double precision,integer,text,text);
DROP FUNCTION IF EXISTS match_chunks(vector,double precision,integer,text,text);
DROP FUNCTION IF EXISTS match_chunks(vector,float,integer,text,text);

-- 6. match_chunks Search Function
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding VECTOR(768),
    match_threshold FLOAT,
    match_count     INT,
    filter_category TEXT DEFAULT NULL,
    filter_crop     TEXT DEFAULT NULL
)
RETURNS TABLE (
    id          UUID,
    content     TEXT,
    source_doc  TEXT,
    source_page INT,
    category    TEXT,
    similarity  FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
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
      AND (filter_crop IS NULL OR dc.crop_tag = filter_crop OR dc.crop_tag IS NULL)
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END; $$;

-- 7. Organic Inputs Reference Table (KG)
CREATE TABLE IF NOT EXISTS organic_inputs (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_kn TEXT,
    transliteration TEXT,
    category TEXT,
    ingredients JSONB,
    preparation_steps_en TEXT[],
    preparation_steps_kn TEXT[],
    fermentation_hours INTEGER,
    application_rate_per_acre TEXT,
    application_unit TEXT,
    application_frequency TEXT,
    application_timing TEXT,
    critical_warnings TEXT[],
    data JSONB
);

-- 8. Mulching Plants Table
CREATE TABLE IF NOT EXISTS mulching_plants (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_kn TEXT,
    transliteration TEXT,
    category TEXT,
    data JSONB
);

-- 9. Karnataka Soil Zones Table
CREATE TABLE IF NOT EXISTS karnataka_soil_zones (
    id TEXT PRIMARY KEY,
    zone_name TEXT NOT NULL,
    zone_kn TEXT,
    districts TEXT[],
    soil_type TEXT,
    data JSONB
);

-- 10. Symptom Deficiency Table
CREATE TABLE IF NOT EXISTS symptom_deficiency_data (
    id TEXT PRIMARY KEY,
    crop_name TEXT,
    deficiency_name TEXT NOT NULL,
    deficiency_kn TEXT,
    symptoms TEXT[],
    correction_measures TEXT[],
    data JSONB
);

-- 11. Crop Reference List
CREATE TABLE IF NOT EXISTS crop_list (
    id TEXT PRIMARY KEY,
    crop_name TEXT NOT NULL,
    crop_kn TEXT,
    category TEXT,
    suitable_zones TEXT[],
    data JSONB
);

-- 12. District Reference List
CREATE TABLE IF NOT EXISTS district_list (
    id TEXT PRIMARY KEY,
    district_name TEXT NOT NULL,
    district_kn TEXT,
    zone TEXT,
    data JSONB
);

-- 13. Disease Reference Database
CREATE TABLE IF NOT EXISTS disease_db (
    id TEXT PRIMARY KEY,
    crop_name TEXT,
    disease_name TEXT NOT NULL,
    disease_kn TEXT,
    symptoms TEXT[],
    treatment_measures TEXT[],
    data JSONB
);

-- 14. Reload PostgREST schema cache to instantly apply changes
NOTIFY pgrst, 'reload schema';
