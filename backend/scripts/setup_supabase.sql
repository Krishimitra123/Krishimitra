-- KrishiMitra — Supabase pgvector Database Setup
-- Run this SQL in the Supabase SQL Editor (one-time setup)

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Main document chunks table
CREATE TABLE IF NOT EXISTS document_chunks (
    id            BIGSERIAL PRIMARY KEY,
    content       TEXT        NOT NULL,
    embedding     VECTOR(768) NOT NULL,
    source_doc    TEXT        NOT NULL,   -- e.g. 'ICAR Organic Farming eCourse'
    source_page   INT,                    -- page number if available
    category      TEXT        NOT NULL,   -- biofertiliser|soil|pest|crop|certification|...
    crop_tag      TEXT,                   -- if chunk is crop-specific
    zone_tag      INT,                    -- Karnataka zone 1-10, null if general
    language      TEXT DEFAULT 'en',      -- en | kn | mixed
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Performance index (HNSW for fast approximate nearest neighbour)
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Category index for filtered searches
CREATE INDEX IF NOT EXISTS idx_document_chunks_category
    ON document_chunks (category);

-- Crop tag index
CREATE INDEX IF NOT EXISTS idx_document_chunks_crop
    ON document_chunks (crop_tag);

-- Helper function for similarity search
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding VECTOR(768),
    match_threshold FLOAT,
    match_count     INT,
    filter_category TEXT DEFAULT NULL,
    filter_crop     TEXT DEFAULT NULL
)
RETURNS TABLE (
    id          BIGINT,
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

-- Verification query (run after setup)
-- SELECT COUNT(*) FROM document_chunks;
