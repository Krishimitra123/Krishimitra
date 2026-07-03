"""
Re-embed all document_chunks using Gemini gemini-embedding-001 (768 dims).
Respects 100 RPM rate limit — waits 65s between batches of 100.
Tracks progress so it can resume if interrupted.
"""

import os, sys, json, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

import google.generativeai as genai
from supabase import create_client

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_KEY']
GEMINI_KEY   = os.environ['GEMINI_API_KEY']

BATCH_SIZE = 50  # Keep well under 100 RPM limit
EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIM = 768
PROGRESS_FILE = Path(__file__).parent / '.reembed_progress.json'

def load_progress():
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text())
    return {'offset': 0, 'done_ids': []}

def save_progress(offset, done_count):
    PROGRESS_FILE.write_text(json.dumps({'offset': offset, 'done_count': done_count}))

def main():
    genai.configure(api_key=GEMINI_KEY)
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    count_resp = client.table('document_chunks').select('id', count='exact').limit(1).execute()
    total = count_resp.count
    
    progress = load_progress()
    offset = progress.get('offset', 0)
    processed = progress.get('done_count', 0)
    
    print(f"Total chunks: {total}, resuming from offset {offset} ({processed} already done)")

    errors = 0

    while offset < total:
        batch = client.table('document_chunks') \
            .select('id,content') \
            .range(offset, offset + BATCH_SIZE - 1) \
            .execute()

        if not batch.data:
            break

        contents = [row['content'] for row in batch.data]
        ids = [row['id'] for row in batch.data]

        try:
            result = genai.embed_content(
                model=EMBEDDING_MODEL,
                content=contents,
                task_type="retrieval_document",
                output_dimensionality=EMBEDDING_DIM,
            )
            embeddings = result['embedding']

            for chunk_id, emb in zip(ids, embeddings):
                try:
                    client.table('document_chunks').update({
                        'embedding': emb
                    }).eq('id', chunk_id).execute()
                except Exception as e:
                    print(f"  Update error {chunk_id}: {e}")
                    errors += 1

            processed += len(batch.data)
            offset += BATCH_SIZE
            save_progress(offset, processed)
            pct = 100 * processed / total
            print(f"  [{processed}/{total}] {pct:.1f}% done")

        except Exception as e:
            print(f"  Batch error at offset {offset}: {e}")
            errors += 1
            # Wait longer on rate limit
            if '429' in str(e):
                print("  Rate limited — waiting 65s...")
                time.sleep(65)
                continue  # Retry same batch
            offset += BATCH_SIZE  # Skip on other errors

        # Wait 65s per batch to stay under 100 RPM
        remaining = total - processed
        if remaining > 0:
            wait = 65
            est_min = (remaining / BATCH_SIZE) * wait / 60
            print(f"  Waiting {wait}s (est. {est_min:.0f} min remaining)...")
            time.sleep(wait)

    # Cleanup progress file
    if PROGRESS_FILE.exists():
        PROGRESS_FILE.unlink()

    print(f"\nDone! Processed {processed} chunks, {errors} errors")

    # Verify
    test_q = genai.embed_content(
        model=EMBEDDING_MODEL,
        content="jeevamrutha preparation organic farming",
        task_type="retrieval_query",
        output_dimensionality=EMBEDDING_DIM,
    )
    resp = client.rpc('match_chunks', {
        'query_embedding': test_q['embedding'],
        'match_threshold': 0.0,
        'match_count': 5,
    }).execute()
    print("\nVerification — top 5 for 'jeevamrutha preparation':")
    for r in (resp.data or []):
        print(f"  sim={r['similarity']:.4f} | {r['content'][:80]}")

if __name__ == '__main__':
    main()
