#!/usr/bin/env python3
"""
Export all document_chunks from Supabase to a JSON file for transfer to teammates.
Usage: python scripts/export_document_chunks.py
Output: document_chunks_export.json (ready to import into teammate's Supabase)
"""

import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

try:
    from supabase import create_client
except ImportError:
    print("ERROR: supabase package not installed")
    print("Run: pip install supabase")
    sys.exit(1)

# ── Supabase Connection ──────────────────────────────────────────

SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY') or os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("🔄 Exporting document_chunks from Supabase...")

# ── Fetch all records in batches ──────────────────────────────────

all_records = []
batch_size = 1000
offset = 0

while True:
    print(f"  Fetching batch {offset // batch_size + 1}...", end="", flush=True)
    
    response = supabase.table("document_chunks") \
        .select("*") \
        .range(offset, offset + batch_size - 1) \
        .execute()
    
    if not response.data:
        print(" ✓ (complete)")
        break
    
    # Convert embedding vectors to lists for JSON serialization
    for record in response.data:
        if 'embedding' in record and record['embedding']:
            # embedding is already a list from Supabase
            if not isinstance(record['embedding'], list):
                record['embedding'] = record['embedding'].tolist()
    
    all_records.extend(response.data)
    print(f" ✓ ({len(response.data)} records)")
    
    offset += batch_size

print(f"\n✅ Total records exported: {len(all_records)}")

# ── Save to JSON file ────────────────────────────────────────────

output_file = Path(__file__).parent.parent.parent / "document_chunks_export.json"

export_data = {
    "metadata": {
        "source": "KrishiMitra Supabase export",
        "record_count": len(all_records),
        "table": "document_chunks",
        "description": "Ingested farming PDFs with vector embeddings for RAG retrieval"
    },
    "records": all_records
}

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(export_data, f, ensure_ascii=False, indent=2)

print(f"📁 Exported to: {output_file}")
print(f"📊 File size: {output_file.stat().st_size / (1024*1024):.1f} MB")

print("\n" + "="*70)
print("NEXT STEPS FOR YOUR FRIEND:")
print("="*70)
print("1. Download document_chunks_export.json from the repo")
print("2. Create a Python script to import (see import_document_chunks.py)")
print("3. Or use the SQL INSERT script approach (see bulk_insert_chunks.sql)")
print("="*70)
