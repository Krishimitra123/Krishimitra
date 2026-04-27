"""
Smoke test for KrishiMitra backend.
Verifies basic imports and module availability.
"""

import sys
from pathlib import Path

def test_imports():
    """Test that all core modules can be imported."""
    try:
        # Test models
        from models.schemas import QueryRequest, DiagnosisRequest
        print("✓ models.schemas imported successfully")
        
        # Test modules
        from modules.m1_voice import process_audio
        from modules.m2_nlp import process_text
        from modules.m3_rag import retrieve_context
        from modules.m4_diagnosis import diagnose
        from modules.m5_response import generate_response
        from modules.m6_guard import guard_output
        from modules.m7_ingest import ingest_document
        print("✓ All core modules imported successfully")
        
        # Test routers
        from routers.query import query_router
        from routers.diagnose import diagnose_router
        from routers.ingest import ingest_router
        from routers.admin import admin_router
        print("✓ All routers imported successfully")
        
        return True
    except ImportError as e:
        print(f"✗ Import failed: {e}")
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

if __name__ == "__main__":
    print("Running KrishiMitra backend smoke tests...\n")
    
    results = []
    results.append(("Directory structure", test_directories()))
    results.append(("Corpus files", test_corpus()))
    results.append(("Module imports", test_imports()))
    
    print("\n" + "="*50)
    print("Smoke Test Summary:")
    print("="*50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
    
    print("="*50)
    print(f"Result: {passed}/{total} tests passed")
    
    sys.exit(0 if passed == total else 1)
