#!/usr/bin/env python3
"""Populate Supabase KG tables from JSON corpus"""
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

supabase = create_client(
    _require_env("SUPABASE_URL"),
    os.getenv("SUPABASE_ANON_KEY") or _require_env("SUPABASE_KEY")
)

CORPUS_PATH = Path(__file__).parent.parent / "corpus" / "structured"

def load_and_insert(table_name: str, json_file: str, batch_size: int = 16):
    """Load JSON and insert into Supabase table"""
    file_path = CORPUS_PATH / json_file
    if not file_path.exists():
        print(f"[SKIP] {json_file} not found")
        return 0
    
    with open(file_path, encoding='utf-8') as f:
        data = json.load(f)
    
    if not isinstance(data, list):
        data = [data]
    
    total = 0
    for i in range(0, len(data), batch_size):
        batch = data[i:i+batch_size]
        try:
            response = supabase.table(table_name).upsert(batch).execute()
            inserted = len(batch)
            total += inserted
            print(f"[{table_name}] Inserted {inserted} records (batch {i//batch_size + 1})")
        except Exception as e:
            print(f"[ERROR] {table_name} batch {i//batch_size + 1}: {str(e)[:100]}")
            # Try individual inserts for fallback
            for record in batch:
                try:
                    supabase.table(table_name).upsert([record]).execute()
                    total += 1
                except:
                    pass
    
    return total

def main():
    print("=" * 60)
    print("Populating KG Tables from Corpus")
    print("=" * 60)
    
    results = {
        "organic_inputs": load_and_insert("organic_inputs", "organic_inputs.json"),
        "mulching_plants": load_and_insert("mulching_plants", "mulching_plants.json"),
        "karnataka_soil_zones": load_and_insert("karnataka_soil_zones", "karnataka_soil_zones.json"),
        "symptom_deficiency_data": load_and_insert("symptom_deficiency_data", "symptom_deficiency_data.json"),
        "crop_list": load_and_insert("crop_list", "crop_list.json"),
        "district_list": load_and_insert("district_list", "district_list.json"),
        "disease_db": load_and_insert("disease_db", "karnataka_disease_db.json"),
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
