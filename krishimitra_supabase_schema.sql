-- KrishiMitra Supabase schema
-- Safe, idempotent baseline for Track 1/2/3 work

begin;

create extension if not exists vector;

create table if not exists public.organic_inputs (
    id text primary key,
    name_en text not null,
    name_kn text not null,
    transliteration text,
    synonyms_kn jsonb,
    category text not null,
    primary_action text not null,
    ingredients jsonb not null,
    preparation_steps jsonb not null,
    fermentation_days int,
    application_rate jsonb,
    application_method text,
    timing text,
    cow_requirements text,
    critical_warnings jsonb,
    common_mistakes jsonb,
    primary_source text not null,
    secondary_sources jsonb,
    confidence_level text not null default 'single_source',
    soil_triad_effect jsonb,
    microbial_content jsonb,
    created_at timestamptz default now()
);

create table if not exists public.mulching_plants (
    id text primary key,
    name_en text not null,
    name_kn text not null,
    botanical text,
    n_fixed_kg_ha_yr int,
    lop_height_cm int,
    lop_frequency_weeks int,
    biomass_decomposition_weeks int,
    planting_density jsonb,
    soil_triad_effect jsonb,
    additional_benefits jsonb,
    karnataka_zones jsonb,
    planting_season text,
    source text not null,
    created_at timestamptz default now()
);

create table if not exists public.document_chunks (
    id bigserial primary key,
    content text not null,
    embedding vector(768) not null,
    source_doc text not null,
    source_page int,
    category text not null,
    crop_tag text,
    zone_tag int,
    language text default 'en',
    tier int default 1,
    is_youtube boolean default false,
    created_at timestamptz default now()
);

create index if not exists document_chunks_embedding_hnsw_idx
    on public.document_chunks
    using hnsw (embedding vector_cosine_ops)
    with (m = 16, ef_construction = 64);

create or replace function public.match_chunks(
    query_embedding vector(768),
    match_threshold float default 0.7,
    match_count int default 5,
    filter_category text default null,
    filter_crop text default null
)
returns table (
    id bigint,
    content text,
    source_doc text,
    source_page int,
    category text,
    similarity float
)
language sql
stable
as $$
    select
        dc.id,
        dc.content,
        dc.source_doc,
        dc.source_page,
        dc.category,
        1 - (dc.embedding <=> query_embedding) as similarity
    from public.document_chunks dc
    where (filter_category is null or dc.category = filter_category)
      and (filter_crop is null or dc.crop_tag = filter_crop)
      and (1 - (dc.embedding <=> query_embedding)) >= match_threshold
    order by dc.embedding <=> query_embedding
    limit match_count;
$$;

create table if not exists public.symptom_deficiency_links (
    id serial primary key,
    symptom_name text,
    deficiency_name text,
    probability float
);

create table if not exists public.deficiency_correction_links (
    id serial primary key,
    deficiency_name text,
    organic_input_id text,
    effectiveness text
);

create table if not exists public.zone_deficiency_links (
    id serial primary key,
    zone_id int,
    deficiency_name text,
    prevalence_pct int
);

create table if not exists public.crop_input_links (
    id serial primary key,
    crop_name text,
    organic_input_id text,
    benefit_description text
);

create index if not exists organic_inputs_name_en_idx on public.organic_inputs (name_en);
create index if not exists organic_inputs_name_kn_idx on public.organic_inputs (name_kn);
create index if not exists mulching_plants_name_en_idx on public.mulching_plants (name_en);
create index if not exists mulching_plants_name_kn_idx on public.mulching_plants (name_kn);

commit;
