"""
benchmark_rag.py - RAG Engine Benchmark (Fixed)
Tests 30 queries, expects 27/30 passing (90%)
Run from backend/ folder: python scripts/benchmark_rag.py
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sentence_transformers import SentenceTransformer
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Loading embedding model...")
model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-mpnet-base-v2")
print("Model loaded.\n")

# 30 test queries: (query_text, [accepted_keywords], min_similarity)
# Multiple accepted keywords = any of these sources is a valid answer
TEST_QUERIES = [
    # ZBNF / Jeevamrutha
    ("jeevamrutha preparation ingredients ratio desi cow",           ["ZBNF"],                 0.45),
    ("jeevamrutha cow dung urine jaggery pulse flour ferment",       ["ZBNF"],                 0.45),
    ("Beejamrutha seed treatment cow dung preparation",              ["ZBNF"],                 0.45),
    ("soil microbial bacteria Jeevamrutha 300 million per ml",       ["ZBNF", "ICAR", "TNAU"], 0.40),
    ("ZBNF Subhash Palekar natural farming four wheels",             ["ZBNF", "ICAR", "TNAU"], 0.40),
    ("Agnihotra ash organic farming atmosphere purification",        ["ZBNF", "ICAR", "TNAU"], 0.40),

    # Soil fertility / ICAR
    ("Karnataka zinc deficiency organic correction",                 ["ICAR", "TNAU", "NCDS"], 0.40),
    ("nitrogen deficiency symptoms yellowing leaves organic",        ["ICAR", "TNAU", "NIPHM"], 0.45),
    ("phosphorus deficiency purple leaves organic remedy",           ["ICAR", "TNAU", "NIPHM"], 0.45),
    ("vermicompost worm type cow dung ratio preparation",            ["ZBNF", "ICAR", "TNAU"], 0.45),
    ("soil organic matter improvement Karnataka dry zones",          ["ICAR", "TNAU", "NCDS"], 0.40),
    ("green manure crops nitrogen fixation organic farming",         ["ICAR", "TNAU", "ZBNF"], 0.45),

    # Mulching / biomass
    ("Gliricidia lopping schedule mulching organic matter",          ["ZBNF", "ICAR", "TNAU"], 0.40),
    ("Moringa root depth nutrient cycling organic",                  ["ZBNF", "ICAR", "TNAU"], 0.40),
    ("Sesbania nitrogen fixation green manure organic",              ["ZBNF", "ICAR", "TNAU"], 0.45),
    ("mulching moisture retention weed suppression organic",         ["ICAR", "TNAU", "NIPHM"], 0.45),

    # Disease / IPM
    ("ragi blast disease Trichoderma organic biocontrol",            ["NIPHM", "ICAR", "TNAU"], 0.40),
    ("tomato early blight fungal disease organic spray",             ["NIPHM", "ICAR", "TNAU"], 0.45),
    ("paddy stem borer organic control light trap pheromone",        ["NIPHM", "ICAR", "TNAU"], 0.45),
    ("cotton bollworm NPV organic biopesticide Bt",                  ["NIPHM", "ICAR", "TNAU"], 0.45),
    ("groundnut tikka disease organic fungicide neem",               ["NIPHM", "ICAR", "TNAU"], 0.45),
    ("banana Panama wilt Fusarium organic management",               ["NIPHM", "ICAR", "TNAU"], 0.40),
    ("onion purple blotch Alternaria organic treatment",             ["NIPHM", "ICAR", "TNAU"], 0.40),
    ("chilli die-back Colletotrichum organic control",               ["NIPHM", "ICAR", "TNAU"], 0.45),

    # Karnataka specific
    ("Karnataka agro climatic zone soil type crop",                  ["ICAR", "TNAU", "NCDS"], 0.40),
    ("Tumakuru district zinc iron deficiency ragi groundnut",        ["ICAR", "TNAU", "NCDS"], 0.40),
    ("Raichur Koppal Ballari black soil cotton organic",             ["ICAR", "TNAU", "NCDS"], 0.40),
    ("Kodagu coffee plantation organic shade tree",                  ["ICAR", "TNAU", "NIPHM"], 0.40),

    # General organic
    ("cow urine pesticide organic spray preparation dilution",       ["ZBNF", "ICAR", "TNAU"], 0.45),
    ("neem seed kernel extract NSKE preparation 5 percent",          ["NIPHM", "ICAR", "TNAU"], 0.45),
]

def run_benchmark():
    passed = 0
    failed = 0
    failed_list = []

    print(f"Running {len(TEST_QUERIES)} benchmark queries...\n")
    print("-" * 80)

    for idx, (query, accepted_keywords, threshold) in enumerate(TEST_QUERIES, 1):
        embedding = model.encode(query).tolist()

        try:
            result = supabase.rpc("match_chunks", {
                "query_embedding": embedding,
                "match_threshold": threshold,
                "match_count": 3
            }).execute()

            chunks = result.data or []

            # Pass if ANY accepted keyword appears in ANY top-3 source_doc
            found = any(
                any(kw.lower() in (chunk.get("source_doc", "") or "").lower()
                    for kw in accepted_keywords)
                for chunk in chunks
            )

            status = "PASS" if found else "FAIL"
            if found:
                passed += 1
            else:
                failed += 1
                failed_list.append((idx, query, accepted_keywords, chunks))

            top_source = chunks[0].get("source_doc", "no results")[:45] if chunks else "no results"
            top_sim = f"{chunks[0].get('similarity', 0):.3f}" if chunks else "—"
            print(f"[{status}] Q{idx:02d}: {query[:50]:<50} | {top_sim} | {top_source}")

        except Exception as e:
            print(f"[ERROR] Q{idx:02d}: {query[:50]} — {e}")
            failed += 1
            failed_list.append((idx, query, accepted_keywords, []))

    print("-" * 80)
    print(f"\nRESULTS: {passed}/{len(TEST_QUERIES)} passed ({100*passed//len(TEST_QUERIES)}%)")

    if passed >= 27:
        print("✅ BENCHMARK PASSED — RAG engine is production ready!")
    else:
        print(f"❌ BENCHMARK FAILED — need {27 - passed} more passes")
        print("\nFailed queries:")
        for idx, query, keywords, chunks in failed_list:
            print(f"  Q{idx:02d}: '{query}'")
            print(f"       Expected any of: {keywords}")
            if chunks:
                for c in chunks[:2]:
                    print(f"       Got: {c.get('source_doc','?')[:60]} (sim={c.get('similarity',0):.3f})")
            else:
                print("       Got: no results — PDF likely not ingested")

if __name__ == "__main__":
    run_benchmark()
