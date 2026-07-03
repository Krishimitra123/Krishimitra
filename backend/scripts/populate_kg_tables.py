#!/usr/bin/env python3
"""
Populate Supabase KG tables from JSON corpus with schema mapping.
Converts raw JSON keys to match Postgres columns and stores extra fields in JSONB.
"""
import json
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing: {name}")
    return value

key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
if not key:
    raise RuntimeError("Missing SUPABASE_KEY or SUPABASE_SERVICE_KEY")

supabase = create_client(
    _require_env("SUPABASE_URL"),
    key
)

CORPUS_PATH = Path(__file__).parent.parent / "corpus" / "structured"

def map_organic_inputs(data: list) -> list:
    mapped = []
    for item in data:
        row = {
            "id": item.get("id"),
            "name_en": item.get("name_en"),
            "name_kn": item.get("name_kn"),
            "transliteration": item.get("transliteration"),
            "category": item.get("category"),
            "ingredients": item.get("ingredients"),
            "preparation_steps_en": item.get("preparation_steps_en"),
            "preparation_steps_kn": item.get("preparation_steps_kn"),
            "fermentation_hours": item.get("fermentation_hours"),
            "application_rate_per_acre": item.get("application_rate_per_acre"),
            "application_unit": item.get("application_unit"),
            "application_frequency": item.get("application_frequency"),
            "application_timing": item.get("application_timing"),
            "critical_warnings": item.get("critical_warnings"),
            "data": {k: v for k, v in item.items() if k not in [
                "id", "name_en", "name_kn", "transliteration", "category", "ingredients",
                "preparation_steps_en", "preparation_steps_kn", "fermentation_hours",
                "application_rate_per_acre", "application_unit", "application_frequency",
                "application_timing", "critical_warnings"
            ]}
        }
        mapped.append(row)
    return mapped

def map_mulching_plants(data: list) -> list:
    mapped = []
    for item in data:
        row = {
            "id": item.get("id"),
            "name_en": item.get("name_en"),
            "name_kn": item.get("name_kn"),
            "transliteration": item.get("transliteration"),
            "category": item.get("category"),
            "data": {k: v for k, v in item.items() if k not in [
                "id", "name_en", "name_kn", "transliteration", "category"
            ]}
        }
        mapped.append(row)
    return mapped

def map_soil_zones(data: list) -> list:
    mapped = []
    for item in data:
        row = {
            "id": str(item.get("zone_id", "")),
            "zone_name": item.get("zone_name"),
            "zone_kn": item.get("zone_kn", item.get("zone_name")),
            "districts": item.get("districts"),
            "soil_type": item.get("dominant_soil_type"),
            "data": {k: v for k, v in item.items() if k not in [
                "zone_id", "zone_name", "zone_kn", "districts", "dominant_soil_type"
            ]}
        }
        mapped.append(row)
    return mapped

def map_symptom_deficiencies(data: list) -> list:
    mapped = []
    for item in data:
        row = {
            "id": item.get("symptom_id"),
            "crop_name": "General",
            "deficiency_name": item.get("symptom_en"),
            "deficiency_kn": item.get("symptom_kn"),
            "symptoms": [item.get("symptom_en")],
            "correction_measures": item.get("field_checks", []),
            "data": {k: v for k, v in item.items() if k not in [
                "symptom_id", "symptom_en", "symptom_kn", "field_checks"
            ]}
        }
        mapped.append(row)
    return mapped

def map_crop_list(data: list) -> list:
    mapped = []
    for item in data:
        row = {
            "id": item.get("name_en", "").lower().replace(" ", "_"),
            "crop_name": item.get("name_en"),
            "crop_kn": item.get("name_kn"),
            "category": item.get("category"),
            "suitable_zones": [str(z) for z in item.get("zones", [])],
            "data": {k: v for k, v in item.items() if k not in [
                "name_en", "name_kn", "category", "zones"
            ]}
        }
        mapped.append(row)
    return mapped

def map_district_list(data: list) -> list:
    mapped = []
    for item in data:
        if isinstance(item, str):
            row = {
                "id": item.lower().replace(" ", "_"),
                "district_name": item,
                "district_kn": None,
                "zone": None,
                "data": {}
            }
            mapped.append(row)
    return mapped

def map_disease_db(data: list) -> list:
    mapped = []
    for item in data:
        row = {
            "id": item.get("id"),
            "crop_name": item.get("crop_en"),
            "disease_name": item.get("disease_en"),
            "disease_kn": item.get("disease_kn"),
            "symptoms": item.get("symptoms"),
            "treatment_measures": item.get("organic_treatments"),
            "data": {k: v for k, v in item.items() if k not in [
                "id", "crop_en", "disease_en", "disease_kn", "symptoms", "organic_treatments"
            ]}
        }
        mapped.append(row)
    return mapped


def load_insert_mapped(table_name: str, json_file: str, map_func, batch_size: int = 16):
    """Load JSON, transform, and insert into Supabase table"""
    file_path = CORPUS_PATH / json_file
    if not file_path.exists():
        print(f"[SKIP] {json_file} not found")
        return 0
    
    with open(file_path, encoding='utf-8') as f:
        raw_data = json.load(f)
    
    mapped_data = map_func(raw_data)
    
    total = 0
    for i in range(0, len(mapped_data), batch_size):
        batch = mapped_data[i:i+batch_size]
        try:
            supabase.table(table_name).upsert(batch).execute()
            inserted = len(batch)
            total += inserted
            print(f"[{table_name}] Inserted {inserted} records (batch {i//batch_size + 1})")
        except Exception as e:
            print(f"[ERROR] {table_name} batch {i//batch_size + 1}: {str(e)[:150]}")
            # Try individual inserts for fallback
            for record in batch:
                try:
                    supabase.table(table_name).upsert([record]).execute()
                    total += 1
                except Exception as ex:
                    print(f"  [FAIL] Record {record.get('id')}: {str(ex)[:100]}")
    
    return total

def main():
    print("=" * 60)
    print("Populating KG Tables from Corpus with Schema Mappings")
    print("=" * 60)
    
    results = {
        "organic_inputs": load_insert_mapped("organic_inputs", "organic_inputs.json", map_organic_inputs),
        "mulching_plants": load_insert_mapped("mulching_plants", "mulching_plants.json", map_mulching_plants),
        "karnataka_soil_zones": load_insert_mapped("karnataka_soil_zones", "karnataka_soil_zones.json", map_soil_zones),
        "symptom_deficiency_data": load_insert_mapped("symptom_deficiency_data", "symptom_deficiency_data.json", map_symptom_deficiencies),
        "crop_list": load_insert_mapped("crop_list", "crop_list.json", map_crop_list),
        "district_list": load_insert_mapped("district_list", "district_list.json", map_district_list),
        "disease_db": load_insert_mapped("disease_db", "karnataka_disease_db.json", map_disease_db),
    }
    
    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    total_inserted = 0
    for table, count in results.items():
        print(f"{table:.<30} {count:>3} records")
        total_inserted += count
    print(f"{'Total':.<30} {total_inserted:>3} records")
    print("=" * 60)

if __name__ == "__main__":
    main()
