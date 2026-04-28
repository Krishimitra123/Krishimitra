#!/usr/bin/env python3
"""Create KG tables in Supabase if they don't exist"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing: {name}")
    return value

supabase = create_client(
    _require_env("SUPABASE_URL"),
    os.getenv("SUPABASE_ANON_KEY") or _require_env("SUPABASE_KEY")
)

print("Connected to Supabase")

# SQL to create all KG tables
sql_commands = [
    """
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
        application_rate_per_acre NUMERIC,
        application_unit TEXT,
        application_frequency TEXT,
        application_timing TEXT,
        critical_warnings TEXT[],
        data JSONB
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS mulching_plants (
        id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL,
        name_kn TEXT,
        transliteration TEXT,
        category TEXT,
        data JSONB
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS karnataka_soil_zones (
        id TEXT PRIMARY KEY,
        zone_name TEXT NOT NULL,
        zone_kn TEXT,
        districts TEXT[],
        soil_type TEXT,
        data JSONB
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS symptom_deficiency_data (
        id TEXT PRIMARY KEY,
        crop_name TEXT,
        deficiency_name TEXT NOT NULL,
        deficiency_kn TEXT,
        symptoms TEXT[],
        correction_measures TEXT[],
        data JSONB
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS crop_list (
        id TEXT PRIMARY KEY,
        crop_name TEXT NOT NULL,
        crop_kn TEXT,
        category TEXT,
        suitable_zones TEXT[],
        data JSONB
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS district_list (
        id TEXT PRIMARY KEY,
        district_name TEXT NOT NULL,
        district_kn TEXT,
        zone TEXT,
        data JSONB
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS disease_db (
        id TEXT PRIMARY KEY,
        crop_name TEXT,
        disease_name TEXT NOT NULL,
        disease_kn TEXT,
        symptoms TEXT[],
        treatment_measures TEXT[],
        data JSONB
    )
    """
]

try:
    for i, sql in enumerate(sql_commands, 1):
        result = supabase.postgrest.postgrest.session.post(
            f"{supabase.postgrest.base_url}/rpc/query",
            json={"command": sql},
            headers={"apikey": os.getenv("SUPABASE_ANON_KEY") or _require_env("SUPABASE_KEY")}
        )
        print(f"Table {i}: Created")
except Exception as e:
    print(f"Error executing SQL: {e}")
    print("Tables may already exist, proceeding with data insertion...")
    pass
