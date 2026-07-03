"""
Smoke test for KrishiMitra backend.
Verifies basic imports and module availability.
Uses the actual exported function names from each module.
"""

import sys
from pathlib import Path


def test_imports():
    """Test that all core modules can be imported with correct function names."""
    try:
        # Test models
        from models.schemas import QueryRequest, DiagnosisRequest
        print("✓ models.schemas imported successfully")

        # M1 — Voice (STT + TTS)
        from modules.m1_voice import audio_to_transcript, text_to_audio
        print("✓ m1_voice: audio_to_transcript, text_to_audio")

        # M2 — NLP
        from modules.m2_nlp import process, detect_language, classify_intent, extract_entities
        print("✓ m2_nlp: process, detect_language, classify_intent, extract_entities")

        # M3 — RAG
        from modules.m3_rag import retrieve
        print("✓ m3_rag: retrieve")

        # M4 — Diagnosis
        from modules.m4_diagnosis import diagnose
        print("✓ m4_diagnosis: diagnose")

        # M5 — Response (Mistral / Gemini)
        from modules.m5_response import generate
        print("✓ m5_response: generate")

        # M6 — Guard (chemical filter, hallucination check)
        from modules.m6_guard import verify_response, filter_chemical_inputs
        print("✓ m6_guard: verify_response, filter_chemical_inputs")

        # M7 — Ingest
        from modules.m7_ingest import ingest_seed_chunks, ingest_pdf, get_corpus_stats
        print("✓ m7_ingest: ingest_seed_chunks, ingest_pdf, get_corpus_stats")

        # Test routers — all use 'router' as the variable name
        from routers.query import router as query_router
        from routers.diagnose import router as diagnose_router
        from routers.ingest import router as ingest_router
        from routers.admin import router as admin_router
        print("✓ All routers imported successfully")

        return True
    except ImportError as e:
        print(f"✗ Import failed: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        return False


def test_corpus():
    """Test that corpus files exist."""
    corpus_path = Path(__file__).parent / "corpus"
    required_files = [
        "crop_list.json",
        "district_list.json",
        "seed_chunks.json",
        "vocab_glossary.json",
    ]

    missing = []
    for file in required_files:
        if not (corpus_path / file).exists():
            missing.append(file)

    if missing:
        print(f"✗ Missing corpus files: {missing}")
        return False

    print("✓ All required corpus files present")
    return True


def test_directories():
    """Test that required directories exist."""
    backend_path = Path(__file__).parent
    required_dirs = [
        "corpus",
        "models",
        "modules",
        "routers",
        "scripts",
    ]

    missing = []
    for dir_name in required_dirs:
        if not (backend_path / dir_name).is_dir():
            missing.append(dir_name)

    if missing:
        print(f"✗ Missing directories: {missing}")
        return False

    print("✓ All required directories present")
    return True


def test_env_vars():
    """Test that environment variables are configured."""
    import os
    # In local dev these come from .env; on Render they are set in the dashboard
    env_vars = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_KEY",
        "SARVAM_API_KEY",
        "GEMINI_API_KEY",
        "MISTRAL_API_KEY",
    ]

    missing = [k for k in env_vars if not os.environ.get(k)]

    if missing:
        print(f"⚠ Env vars not set (expected in .env or Render dashboard): {missing}")
    else:
        print("✓ All env vars present")

    # Never fail here in local dev — just warn
    return True


if __name__ == "__main__":
    print("Running KrishiMitra backend smoke tests...\n")

    results = []
    results.append(("Directory structure", test_directories()))
    results.append(("Corpus files",        test_corpus()))
    results.append(("Module imports",      test_imports()))
    results.append(("Environment vars",    test_env_vars()))

    print("\n" + "=" * 50)
    print("Smoke Test Summary:")
    print("=" * 50)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"  {status}  {test_name}")

    print("=" * 50)
    print(f"Result: {passed}/{total} tests passed")

    sys.exit(0 if passed == total else 1)
