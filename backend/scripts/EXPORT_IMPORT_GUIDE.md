# Exporting and Importing Document Chunks

This folder contains scripts to export and import the ingested document chunks (embeddings and content) between Supabase instances. This allows you to share your knowledge base with teammates.

## Why Export?

- Share ingested PDFs and embeddings with teammates
- Ensure all team members have the same knowledge base
- Faster setup — no need to re-ingest all PDFs
- More accurate responses with consistent data

## Export Instructions (Your Side)

### Step 1: Run the Export Script
```bash
cd backend
python scripts/export_document_chunks.py
```

This will:
- Query all records from your `document_chunks` table
- Export to `document_chunks_export.json` (~20-50 MB depending on records)
- Show progress and summary

### Step 2: Send to Your Friend
Upload `document_chunks_export.json` to:
- GitHub repo folder, or
- Google Drive / Dropbox, or
- Email (if not too large)

## Import Instructions (Friend's Side)

### Step 1: Download the Export File
Get `document_chunks_export.json` from your source

### Step 2: Set Up Supabase
First, run the schema setup:
```bash
# In Supabase SQL Editor, run:
krishimitra_supabase_schema.sql
```

### Step 3: Import the Records
```bash
cd backend
python scripts/import_document_chunks.py /path/to/document_chunks_export.json
```

This will:
- Read the export JSON file
- Insert records in batches of 500
- Show progress and success rate
- Report any errors

### Step 4: Verify Import
```bash
python scripts/test_rag_retrieval.py
```

If queries return results with high similarity scores, the import was successful!

## File Format

The export JSON structure:
```json
{
  "metadata": {
    "source": "KrishiMitra Supabase export",
    "record_count": 7000,
    "table": "document_chunks",
    "description": "Ingested farming PDFs with vector embeddings"
  },
  "records": [
    {
      "id": "uuid",
      "content": "text chunk",
      "embedding": [0.123, 0.456, ...],
      "source_doc": "ICAR Organic Farming eCourse",
      "source_page": 42,
      "category": "biofertiliser",
      "crop_tag": "general",
      "zone_tag": 5,
      "language": "en",
      "tier": 1,
      "is_youtube": false,
      "created_at": "2026-04-28T..."
    },
    ...
  ]
}
```

## Troubleshooting

### "ModuleNotFoundError: No module named 'supabase'"
Run: `pip install -r requirements.txt`

### "ERROR: SUPABASE_URL and SUPABASE_KEY must be set"
Create `.env` file with your Supabase credentials

### Import is slow
- Expected for 7,000+ records
- Each record includes a 768-dimensional vector
- Batch size is set to 500 for reliability
- Typical time: 5-15 minutes depending on internet speed

### "Embedding dimension mismatch" error
- Ensure your schema has `vector(768)` for the embedding column
- Re-run the schema setup script if unsure

## Advanced: Manual SQL Import

If Python import fails, you can use SQL directly:

1. Export your database as SQL:
   ```sql
   SELECT json_agg(row_to_json(t)) 
   FROM document_chunks t;
   ```

2. In Supabase SQL Editor, construct INSERT statements:
   ```sql
   INSERT INTO document_chunks (id, content, embedding, source_doc, ...)
   VALUES (...), (...), ... 
   ON CONFLICT (id) DO NOTHING;
   ```

3. Use bulk insert in smaller chunks (100 rows at a time)

## Contact

If you encounter issues:
1. Check the error message carefully
2. Verify Supabase credentials
3. Ensure schema is set up correctly
4. Check internet connection during import
5. Contact the backend lead for debugging
