import os
import json
import hashlib
from typing import Any

import pdfplumber
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter
from supabase import create_client

load_dotenv()


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value

# ── Supabase credentials ──────────────────────────────────────────
SUPABASE_URL = _require_env("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_ANON_KEY or SUPABASE_KEY")

# ── Paths ─────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR     = os.path.join(BASE_DIR, "corpus", "raw")
STRUCT_DIR  = os.path.join(BASE_DIR, "corpus", "structured")

# ── Document manifest ─────────────────────────────────────────────
DOCUMENTS = [
    # PDFs
    {
        "path": os.path.join(RAW_DIR, "ICAR_Organic_Farming_eCourse.pdf"),
        "source_doc": "ICAR Organic Farming eCourse",
        "category": "organic_farming",
        "crop_tag": "general",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "pdf"
    },
    {
        "path": os.path.join(RAW_DIR, "TNAU_Organic_Farming_2024.pdf"),
        "source_doc": "TNAU Organic Farming E-Book 2024",
        "category": "organic_farming",
        "crop_tag": "general",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "pdf"
    },
    {
        "path": os.path.join(RAW_DIR, "ICAR_Soil_Fertility_Nutrient_Management.pdf"),
        "source_doc": "ICAR Soil Fertility and Nutrient Management eCourse",
        "category": "soil_fertility",
        "crop_tag": "general",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "pdf"
    },
    {
        "path": os.path.join(RAW_DIR, "ZBNF_ResearchGate_2022.pdf"),
        "source_doc": "ZBNF ResearchGate 2022",
        "category": "biofertiliser",
        "crop_tag": "general",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "pdf"
    },
    {
        "path": os.path.join(RAW_DIR, "NCDS_WP70_ZBNF_Karnataka.pdf"),
        "source_doc": "NCDS WP70 ZBNF Karnataka",
        "category": "soil_fertility",
        "crop_tag": "general",
        "zone_tag": "karnataka",
        "language": "en",
        "tier": 1,
        "type": "pdf"
    },
    {
        "path": os.path.join(RAW_DIR, "Natural_Farming_Principles.pdf"),
        "source_doc": "Natural Farming Principles and Prospects",
        "category": "organic_farming",
        "crop_tag": "general",
        "zone_tag": "all",
        "language": "en",
        "tier": 2,
        "type": "pdf"
    },
    {
        "path": os.path.join(RAW_DIR, "NIPHM_IPM_Rice.pdf"),
        "source_doc": "NIPHM IPM Package Rice",
        "category": "ipm_disease",
        "crop_tag": "paddy",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "pdf"
    },
    {
        "path": os.path.join(RAW_DIR, "NIPHM_IPM_Tomato.pdf"),
        "source_doc": "NIPHM IPM Package Tomato",
        "category": "ipm_disease",
        "crop_tag": "tomato",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "pdf"
    },
    {
        "path": os.path.join(RAW_DIR, "NIPHM_IPM_Cotton.pdf"),
        "source_doc": "NIPHM IPM Package Cotton",
        "category": "ipm_disease",
        "crop_tag": "cotton",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "pdf"
    },
    {
        "path": os.path.join(RAW_DIR, "NIPHM_IPM_Chilli.pdf"),
        "source_doc": "NIPHM IPM Package Chilli",
        "category": "ipm_disease",
        "crop_tag": "chilli",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "pdf"
    },
    {
        "path": os.path.join(RAW_DIR, "NIPHM_IPM_Groundnut.pdf"),
        "source_doc": "NIPHM IPM Package Groundnut",
        "category": "ipm_disease",
        "crop_tag": "groundnut",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "pdf"
    },
    {
        "path": os.path.join(RAW_DIR, "NIPHM_IPM_Onion.pdf"),
        "source_doc": "NIPHM IPM Package Onion",
        "category": "ipm_disease",
        "crop_tag": "onion",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "pdf"
    },
    {
        "path": os.path.join(RAW_DIR, "NIPHM_IPM_Banana.pdf"),
        "source_doc": "NIPHM IPM Package Banana",
        "category": "ipm_disease",
        "crop_tag": "banana",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "pdf"
    },
    # JSON structured files
    {
        "path": os.path.join(STRUCT_DIR, "karnataka_soil_zones.json"),
        "source_doc": "Karnataka Soil Zones Structured DB",
        "category": "soil_fertility",
        "crop_tag": "general",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "json"
    },
    {
        "path": os.path.join(STRUCT_DIR, "karnataka_disease_db.json"),
        "source_doc": "Karnataka Disease Database",
        "category": "ipm_disease",
        "crop_tag": "general",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "json"
    },
    {
        "path": os.path.join(STRUCT_DIR, "organic_inputs.json"),
        "source_doc": "Organic Inputs Structured DB",
        "category": "biofertiliser",
        "crop_tag": "general",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "json"
    },
    {
        "path": os.path.join(STRUCT_DIR, "mulching_plants.json"),
        "source_doc": "Mulching Plants Structured DB",
        "category": "mulching",
        "crop_tag": "general",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "json"
    },
    {
        "path": os.path.join(STRUCT_DIR, "crop_list.json"),
        "source_doc": "Karnataka Crop List",
        "category": "crop_info",
        "crop_tag": "general",
        "zone_tag": "all",
        "language": "en",
        "tier": 1,
        "type": "json"
    },
    {
        "path": os.path.join(STRUCT_DIR, "district_list.json"),
        "source_doc": "Karnataka District List",
        "category": "location",
        "crop_tag": "general",
        "zone_tag": "all",
        "language": "en",
        "tier": 2,
        "type": "json"
    },
]

# ── Text splitter ─────────────────────────────────────────────────
splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=50,
    separators=["\n\n", "\n", ". ", "। ", " "]
)

EMBED_BATCH_SIZE = int(os.getenv("EMBED_BATCH_SIZE", "32"))
UPLOAD_BATCH_SIZE = int(os.getenv("UPLOAD_BATCH_SIZE", "16"))


def _stable_chunk_uid(source_doc: str, chunk_text: str, source_page: int | None) -> str:
    raw = f"{source_doc}|{source_page}|{chunk_text}".encode("utf-8", errors="ignore")
    return hashlib.sha1(raw).hexdigest()


def extract_text_from_pdf(path: str) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []
    try:
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text and len(text.strip()) >= 50:
                    pages.append({"page": i + 1, "text": text})
                else:
                    print(f"  ⚠ Skipping page {i+1} (too short or empty)")
    except Exception as e:
        print(f"  [ERROR] Error reading PDF: {e}")
    return pages


def extract_text_from_json(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return "\n\n".join([json.dumps(item, ensure_ascii=False) for item in data])
        else:
            return json.dumps(data, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"  [ERROR] Error reading JSON: {e}")
        return ""


def ingest_document(doc, model, supabase):
    path = doc["path"]
    print(f"\n[DOC] Processing: {doc['source_doc']}")

    if not os.path.exists(path):
        print(f"  ⚠ File not found, skipping: {path}")
        return 0

    # Extract text and build text units carrying page context where possible
    units: list[dict[str, Any]] = []
    if doc["type"] == "pdf":
        page_blocks = extract_text_from_pdf(path)
        for block in page_blocks:
            chunks = splitter.split_text(block["text"])
            for chunk in chunks:
                units.append({"text": chunk, "source_page": block["page"]})
    else:
        text = extract_text_from_json(path)
        for chunk in splitter.split_text(text):
            units.append({"text": chunk, "source_page": None})

    if not units:
        print(f"  ⚠ No text extracted, skipping")
        return 0

    print(f"  [SCISSORS] {len(units)} chunks created")

    # Encode in batches of 32
    rows = []
    for i in range(0, len(units), EMBED_BATCH_SIZE):
        batch = units[i:i + EMBED_BATCH_SIZE]
        batch_texts = [u["text"] for u in batch]
        embeddings = model.encode(batch_texts, show_progress_bar=False)
        for unit, embedding in zip(batch, embeddings):
            chunk_text = unit["text"]
            source_page = unit["source_page"]
            rows.append({
                "chunk_uid": _stable_chunk_uid(doc["source_doc"], chunk_text, source_page),
                "content": chunk_text,
                "source_doc": doc["source_doc"],
                "source_page": source_page,
                "category": doc["category"],
                "crop_tag": doc["crop_tag"],
                "zone_tag": doc["zone_tag"],
                "language": doc["language"],
                "tier": doc["tier"],
                "metadata": {
                    "source_doc": doc["source_doc"],
                    "source_page": source_page,
                    "category":   doc["category"],
                    "crop_tag":   doc["crop_tag"],
                    "zone_tag":   doc["zone_tag"],
                    "language":   doc["language"],
                    "tier":       doc["tier"],
                },
                "embedding": embedding.tolist()
            })

    # Upload in small batches; fallback to insert if upsert contract differs.
    uploaded = 0
    for i in range(0, len(rows), UPLOAD_BATCH_SIZE):
        batch = rows[i:i + UPLOAD_BATCH_SIZE]
        try:
            supabase.table("document_chunks").upsert(batch).execute()
            uploaded += len(batch)
            print(f"  ⬆ Uploaded {uploaded}/{len(rows)} chunks")
        except Exception as e:
            print(f"  ⚠ Upsert failed, trying insert: {e}")
            try:
                supabase.table("document_chunks").insert(batch).execute()
                uploaded += len(batch)
                print(f"  [UP] Uploaded {uploaded}/{len(rows)} chunks")
            except Exception as inner_e:
                print(f"  [ERROR] Upload error: {inner_e}")

    print(f"  [OK] Done — {uploaded} chunks uploaded")
    return uploaded

def main():
    print("[ROCKET] Starting RAG Ingestion Pipeline")
    print("=" * 50)

    # Load model
    print("\n[BRAIN] Loading sentence-transformers model...")
    model = SentenceTransformer(
        "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
    )
    print("[OK] Model loaded")

    # Connect to Supabase
    print("\n[PLUG] Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("[OK] Connected")

    # Process all documents
    total_chunks = 0
    for doc in DOCUMENTS:
        count = ingest_document(doc, model, supabase)
        total_chunks += count

    print("\n" + "=" * 50)
    print(f"[PARTY] Ingestion complete! Total chunks uploaded: {total_chunks}")
    print("Go to Supabase Table Editor and verify document_chunks has rows.")

if __name__ == "__main__":
    main()