#!/usr/bin/env python3
"""
Import document_chunks from export JSON file into Supabase.
Usage: python scripts/import_document_chunks.py /path/to/document_chunks_export.json
"""

import json
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

try:
    from supabase import create_client
except ImportError:
    print("ERROR: supabase package not installed")
    print("Run: pip install supabase")
    sys.exit(1)

if len(sys.argv) < 2:
    print("Usage: python import_document_chunks.py /path/to/document_chunks_export.json")
    sys.exit(1)

export_file = Path(sys.argv[1])

if not export_file.exists():
    print(f"ERROR: File not found: {export_file}")
    sys.exit(1)

# ── Supabase Connection ──────────────────────────────────────────

SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY') or os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Load export file ────────────────────────────────────────────

print(f"📂 Loading export file: {export_file}")

with open(export_file, 'r', encoding='utf-8') as f:
    export_data = json.load(f)

records = export_data.get('records', [])
metadata = export_data.get('metadata', {})

print(f"📊 Found {len(records)} records to import")
print(f"   Source: {metadata.get('source', 'Unknown')}")
print(f"   Description: {metadata.get('description', 'N/A')}")

# ── Insert in batches ────────────────────────────────────────────

batch_size = 500
total_inserted = 0
failed = 0

for i in range(0, len(records), batch_size):
    batch = records[i:i + batch_size]
    batch_num = i // batch_size + 1
    
    print(f"\n📤 Batch {batch_num}: Inserting {len(batch)} records...", end="", flush=True)
    
    try:
        response = supabase.table("document_chunks").insert(batch).execute()
        total_inserted += len(batch)
        print(f" ✓")
    except Exception as e:
        print(f" ✗ ERROR: {e}")
        failed += len(batch)

print("\n" + "="*70)
print(f"✅ Import complete!")
print(f"   Total inserted: {total_inserted}")
print(f"   Failed: {failed}")
print(f"   Success rate: {100 * total_inserted / len(records):.1f}%")
print("="*70)

if failed == 0:
    print("\n🎉 All records imported successfully!")
    print("Your knowledge base is now ready for RAG retrieval.")
else:
    print(f"\n⚠️  {failed} records failed to import. Check logs above.")
