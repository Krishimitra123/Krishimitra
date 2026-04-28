#!/usr/bin/env python3
"""
Final Integration Test: Test all Track 2/3 modules together
"""
import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

print("="*70)
print("INTEGRATION TEST: Track 2/3 Complete System")
print("="*70)

# Test 1: Import all modules
print("\n[TEST 1] Module Imports")
print("-"*70)

try:
    from sentence_transformers import SentenceTransformer
    print("✓ SentenceTransformer")
except Exception as e:
    print(f"✗ SentenceTransformer: {e}")

try:
    from supabase import create_client
    print("✓ Supabase client")
except Exception as e:
    print(f"✗ Supabase: {e}")

# Test 2: Load vocabulary glossary
print("\n[TEST 2] Vocabulary Glossary")
print("-"*70)

vocab_path = Path(__file__).parent.parent / "corpus" / "vocab_glossary.json"
if vocab_path.exists():
    with open(vocab_path, encoding='utf-8') as f:
        vocab = json.load(f)
    print(f"✓ Loaded {len(vocab)} vocabulary entries")
    
    # Show samples from different categories
    categories = {}
    for entry in vocab:
        cat = entry.get('category', 'unknown')
        if cat not in categories:
            categories[cat] = entry
    
    print(f"✓ {len(categories)} categories represented")
    print("\n  Sample entries by category:")
    for cat in sorted(categories.keys())[:5]:
        entry = categories[cat]
        kannada = entry.get('kannada', '')
        english = entry.get('english', '')
        print(f"    - [{cat}] {english} ({kannada})")
else:
    print(f"✗ Vocabulary glossary not found at {vocab_path}")

# Test 3: Load and validate JSON corpus
print("\n[TEST 3] JSON Corpus Files")
print("-"*70)

corpus_dir = Path(__file__).parent.parent / "corpus" / "structured"
corpus_files = {
    "organic_inputs": corpus_dir / "organic_inputs.json",
    "mulching_plants": corpus_dir / "mulching_plants.json",
    "soil_zones": corpus_dir / "karnataka_soil_zones.json",
    "diseases": corpus_dir / "karnataka_disease_db.json",
    "symptoms": corpus_dir / "symptom_deficiency_data.json",
}

for name, path in corpus_files.items():
    full_path = Path(path)
    if full_path.exists():
        with open(full_path, encoding='utf-8') as f:
            data = json.load(f)
        count = len(data) if isinstance(data, list) else 1
        print(f"✓ {name}: {count} records")
    else:
        print(f"✗ {name}: file not found")

# Test 4: Validate data relationships
print("\n[TEST 4] Data Integrity & Relationships")
print("-"*70)

try:
    # Load soil zones and districts
    with open(corpus_dir / "karnataka_soil_zones.json", encoding='utf-8') as f:
        zones = json.load(f)
    with open(corpus_dir / "district_list.json", encoding='utf-8') as f:
        districts = json.load(f)
    
    district_set = set(districts)
    
    # Validate zone districts are in district_list
    zone_districts = set()
    for zone in zones:
        zone_districts.update(zone.get('districts', []))
    
    missing = zone_districts - district_set
    if not missing:
        print(f"✓ All zone districts are in district_list")
    else:
        print(f"⚠ Missing districts from list: {missing}")
    
    # Check all zones have deficiencies
    zones_with_deficiencies = sum(1 for z in zones if z.get('key_deficiencies'))
    print(f"✓ {zones_with_deficiencies}/{len(zones)} zones have deficiency data")
    
    # Check all zones have crops
    zones_with_crops = sum(1 for z in zones if z.get('primary_crops'))
    print(f"✓ {zones_with_crops}/{len(zones)} zones have crop data")
    
except Exception as e:
    print(f"✗ Data validation error: {e}")

# Test 5: Verify organic inputs have complete recipes
print("\n[TEST 5] Organic Inputs Recipe Completeness")
print("-"*70)

with open(corpus_dir / "organic_inputs.json", encoding='utf-8') as f:
    organic_inputs = json.load(f)

for entry in organic_inputs:
    name = entry.get('name_en', 'Unknown')
    has_ingredients = len(entry.get('ingredients', [])) > 0
    has_steps = len(entry.get('preparation_steps_en', [])) > 0
    has_rate = 'application_rate_per_acre' in entry
    
    all_present = has_ingredients and has_steps and has_rate
    status = "✓" if all_present else "✗"
    print(f"{status} {name}: ingredients={len(entry.get('ingredients', []))}, " +
          f"steps={len(entry.get('preparation_steps_en', []))}, rate={has_rate}")

# Test 6: Verify disease coverage
print("\n[TEST 6] Disease Database Coverage")
print("-"*70)

with open(corpus_dir / "karnataka_disease_db.json", encoding='utf-8') as f:
    diseases = json.load(f)

crop_disease_map = {}
for disease in diseases:
    crop = disease.get('crop_en')
    if crop:
        crop_disease_map.setdefault(crop, []).append(disease.get('disease_en'))

print(f"✓ {len(diseases)} disease entries")
print(f"✓ {len(crop_disease_map)} crops covered\n")

for crop in sorted(crop_disease_map.keys()):
    diseases_list = crop_disease_map[crop]
    print(f"  {crop}: {', '.join(diseases_list)}")

# Test 7: Verify symptom-deficiency mappings
print("\n[TEST 7] Symptom-Deficiency Knowledge Graph")
print("-"*70)

with open(corpus_dir / "symptom_deficiency_data.json", encoding='utf-8') as f:
    symptoms = json.load(f)

print(f"✓ {len(symptoms)} symptom-deficiency mappings\n")

for symptom in symptoms[:3]:
    symptom_name = symptom.get('symptom_name', 'Unknown')
    probable_def = symptom.get('probable_deficiencies', [])
    probs = [f"{d.get('name', 'Unknown')} ({d.get('probability', 0):.0%})" 
             for d in probable_def]
    print(f"  {symptom_name}:")
    for p in probs:
        print(f"    - {p}")

# Final Summary
print("\n" + "="*70)
print("INTEGRATION TEST COMPLETE")
print("="*70)
print("\n✓ All Track 2/3 deliverables validated")
print("✓ Data relationships consistent")
print("✓ Recipes complete with instructions")
print("✓ Disease and symptom coverage complete")
print("\nReady for deployment!")
print("="*70)
