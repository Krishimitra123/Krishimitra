"""
Ingest Structured JSON Data → Supabase document_chunks
Converts Shinan's structured KB JSONs into embedded, searchable chunks.
Run: python scripts/ingest_structured.py
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from sentence_transformers import SentenceTransformer
from supabase import create_client

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_KEY']
MODEL_NAME = os.environ.get('EMBEDDING_MODEL_NAME',
    'sentence-transformers/paraphrase-multilingual-mpnet-base-v2')

model = SentenceTransformer(MODEL_NAME)
client = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE = Path(__file__).parent.parent / 'corpus'


def embed_and_store(chunks: list[dict], batch_size=32):
    """Embed text chunks and store in document_chunks table."""
    total = 0
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        texts = [c['content'] for c in batch]
        embeddings = model.encode(texts, normalize_embeddings=True).tolist()

        rows = []
        for j, chunk in enumerate(batch):
            rows.append({
                'content':     chunk['content'],
                'embedding':   embeddings[j],
                'source_doc':  chunk['source_doc'],
                'source_page': chunk.get('source_page', 0),
                'category':    chunk['category'],
                'crop_tag':    chunk.get('crop_tag'),
                'zone_tag':    chunk.get('zone_tag'),
                'language':    chunk.get('language', 'en'),
            })

        client.table('document_chunks').insert(rows).execute()
        total += len(rows)
        print(f'    Stored batch {i // batch_size + 1} ({total} chunks)')
    return total


def ingest_organic_inputs():
    """Convert organic_inputs.json → detailed preparation chunks."""
    data = json.load(open(BASE / 'structured' / 'organic_inputs.json'))
    chunks = []

    for item in data:
        name = item.get('name_en', '')
        name_kn = item.get('name_kn', '')

        # Chunk 1: Overview + ingredients
        ingredients_text = ""
        for ing in item.get('ingredients', []):
            ingredients_text += f"  • {ing.get('quantity','')} {ing.get('unit','')} {ing.get('name_en','')} ({ing.get('name_kn','')})\n"

        overview = (
            f"{name} ({name_kn}) — {item.get('category', '')}\n"
            f"Primary action: {item.get('primary_action', '')}\n"
            f"Ingredients:\n{ingredients_text}"
            f"Fermentation: {item.get('fermentation_days', 'N/A')} days\n"
            f"Source: {item.get('primary_source', '')}"
        )
        chunks.append({
            'content': overview,
            'source_doc': f"Structured KB — {item.get('primary_source', 'Palekar ZBNF')}",
            'source_page': 1,
            'category': 'biofertiliser',
            'language': 'en',
        })

        # Chunk 2: Preparation steps
        steps = item.get('preparation_steps', [])
        if steps:
            steps_text = f"{name} — Preparation Steps:\n"
            for k, step in enumerate(steps, 1):
                steps_text += f"  Step {k}: {step}\n"
            chunks.append({
                'content': steps_text,
                'source_doc': f"Structured KB — {item.get('primary_source', 'Palekar ZBNF')}",
                'source_page': 2,
                'category': 'biofertiliser',
                'language': 'en',
            })

        # Chunk 3: Application details
        app_rate = item.get('application_rate', {})
        app_method = item.get('application_method', '')
        timing = item.get('timing', '')
        warnings = item.get('critical_warnings', [])
        if app_rate or app_method:
            app_text = (
                f"{name} — Application:\n"
                f"Rate: {json.dumps(app_rate) if isinstance(app_rate, dict) else app_rate}\n"
                f"Method: {app_method}\n"
                f"Timing: {timing}\n"
                f"Cow requirements: {item.get('cow_requirements', 'N/A')}\n"
            )
            if warnings:
                app_text += "Warnings:\n"
                for w in warnings:
                    app_text += f"  ⚠ {w}\n"
            chunks.append({
                'content': app_text,
                'source_doc': f"Structured KB — {item.get('primary_source', 'Palekar ZBNF')}",
                'source_page': 3,
                'category': 'biofertiliser',
                'language': 'en',
            })

        # Chunk 4: Kannada content for cross-language retrieval
        synonyms = item.get('synonyms_kn', [])
        kn_text = (
            f"{name_kn} ({name})\n"
            f"ಸಮಾನಾರ್ಥಕ: {', '.join(synonyms) if synonyms else 'N/A'}\n"
            f"ಮುಖ್ಯ ಕಾರ್ಯ: {item.get('primary_action', '')}\n"
            f"ಹುದುಗು ಅವಧಿ: {item.get('fermentation_days', 'N/A')} ದಿನಗಳು\n"
        )
        chunks.append({
            'content': kn_text,
            'source_doc': f"Structured KB — {item.get('primary_source', 'Palekar ZBNF')}",
            'source_page': 4,
            'category': 'biofertiliser',
            'language': 'kn',
        })

    print(f'  organic_inputs: {len(data)} records → {len(chunks)} chunks')
    return chunks


def ingest_mulching_plants():
    """Convert mulching_plants.json → chunks."""
    data = json.load(open(BASE / 'structured' / 'mulching_plants.json'))
    chunks = []

    for item in data:
        name = item.get('name_en', '')
        name_kn = item.get('name_kn', '')
        botanical = item.get('botanical', '')

        text = (
            f"{name} ({name_kn}) — {botanical}\n"
            f"Nitrogen fixation: {item.get('n_fixed_kg_ha_yr', 'N/A')} kg/ha/year\n"
            f"Lopping height: {item.get('lop_height_cm', 'N/A')} cm\n"
            f"Lopping frequency: every {item.get('lop_frequency_weeks', 'N/A')} weeks\n"
            f"Biomass decomposition: {item.get('biomass_decomposition_weeks', 'N/A')} weeks\n"
            f"Planting density: {json.dumps(item.get('planting_density', {}))}\n"
            f"Planting season: {item.get('planting_season', 'N/A')}\n"
            f"Benefits: {', '.join(item.get('additional_benefits', []))}\n"
            f"Karnataka zones: {json.dumps(item.get('karnataka_zones', []))}\n"
            f"Source: {item.get('source', '')}"
        )
        chunks.append({
            'content': text,
            'source_doc': f"Structured KB — {item.get('source', 'UAS Bangalore')}",
            'source_page': 1,
            'category': 'organic_farming',
            'language': 'en',
        })

    print(f'  mulching_plants: {len(data)} records → {len(chunks)} chunks')
    return chunks


def ingest_disease_db():
    """Convert karnataka_disease_db.json → disease chunks."""
    data = json.load(open(BASE / 'structured' / 'karnataka_disease_db.json'))
    chunks = []

    for item in data:
        crop = item.get('crop', '')
        disease = item.get('disease_name_en', item.get('disease', ''))
        disease_kn = item.get('disease_name_kn', '')
        symptoms = item.get('symptoms', item.get('visual_symptoms', []))
        treatments = item.get('organic_treatment', item.get('organic_treatments', []))
        prevention = item.get('prevention', [])

        text = (
            f"Crop: {crop}\n"
            f"Disease: {disease} ({disease_kn})\n"
            f"Symptoms: {', '.join(symptoms) if isinstance(symptoms, list) else symptoms}\n"
            f"Organic Treatment: {', '.join(treatments) if isinstance(treatments, list) else treatments}\n"
            f"Prevention: {', '.join(prevention) if isinstance(prevention, list) else prevention}\n"
        )
        chunks.append({
            'content': text,
            'source_doc': 'Karnataka Crop Disease Database (Structured KB)',
            'source_page': 1,
            'category': 'pest_disease',
            'crop_tag': crop,
            'language': 'en',
        })

    print(f'  karnataka_disease_db: {len(data)} records → {len(chunks)} chunks')
    return chunks


def ingest_soil_zones():
    """Convert karnataka_soil_zones.json → zone-specific chunks."""
    data = json.load(open(BASE / 'structured' / 'karnataka_soil_zones.json'))
    chunks = []

    for item in data:
        zone_id = item.get('zone_id', item.get('id', ''))
        zone_name = item.get('zone_name', item.get('name', ''))
        districts = item.get('districts', [])
        soil_type = item.get('soil_type', item.get('primary_soil', ''))
        crops = item.get('major_crops', item.get('recommended_crops', []))
        rainfall = item.get('annual_rainfall_mm', item.get('rainfall', ''))

        text = (
            f"Karnataka Agro-Climatic Zone {zone_id}: {zone_name}\n"
            f"Districts: {', '.join(districts) if isinstance(districts, list) else districts}\n"
            f"Soil type: {soil_type}\n"
            f"Annual rainfall: {rainfall} mm\n"
            f"Major crops: {', '.join(crops) if isinstance(crops, list) else crops}\n"
            f"Organic recommendations: Suited for ZBNF practices with local cow-based inputs.\n"
        )
        chunks.append({
            'content': text,
            'source_doc': 'Karnataka Agro-Climatic Zones Database (Structured KB)',
            'source_page': 1,
            'category': 'soil_fertility',
            'zone_tag': zone_id if isinstance(zone_id, int) else None,
            'language': 'en',
        })

    print(f'  karnataka_soil_zones: {len(data)} records → {len(chunks)} chunks')
    return chunks


def ingest_crop_list():
    """Convert crop_list.json → crop info chunks."""
    data = json.load(open(BASE / 'structured' / 'crop_list.json'))
    chunks = []

    for item in data:
        name = item.get('name_en', item.get('name', ''))
        name_kn = item.get('name_kn', '')
        season = item.get('season', '')
        zones = item.get('zones', item.get('karnataka_zones', []))

        text = (
            f"Crop: {name} ({name_kn})\n"
            f"Season: {season}\n"
            f"Karnataka zones: {json.dumps(zones)}\n"
            f"Organic farming suitable: Yes — use Jeevamrutha, Beejamrutha, and organic mulching.\n"
        )
        chunks.append({
            'content': text,
            'source_doc': 'Karnataka Crop List (Structured KB)',
            'source_page': 1,
            'category': 'crop_info',
            'crop_tag': name,
            'language': 'en',
        })

    print(f'  crop_list: {len(data)} records → {len(chunks)} chunks')
    return chunks


def ingest_symptom_deficiency():
    """Convert symptom_deficiency_data.json → diagnostic chunks."""
    data = json.load(open(BASE / 'structured' / 'symptom_deficiency_data.json'))
    chunks = []

    for item in data:
        symptom = item.get('symptom_name', item.get('symptom', ''))
        deficiency = item.get('deficiency', item.get('linked_deficiency', ''))
        description = item.get('description', item.get('visual_description', ''))
        correction = item.get('organic_correction', item.get('correction', ''))

        text = (
            f"Symptom: {symptom}\n"
            f"Deficiency: {deficiency}\n"
            f"Description: {description}\n"
            f"Organic correction: {correction}\n"
        )
        chunks.append({
            'content': text,
            'source_doc': 'Symptom-Deficiency Database (Structured KB)',
            'source_page': 1,
            'category': 'pest_disease',
            'language': 'en',
        })

    print(f'  symptom_deficiency: {len(data)} records → {len(chunks)} chunks')
    return chunks


def ingest_seed_chunks():
    """Ingest pre-made seed_chunks.json (Palekar/ICAR curated chunks)."""
    data = json.load(open(BASE / 'seed_chunks.json'))
    chunks = []

    for item in data:
        chunks.append({
            'content': item['content'],
            'source_doc': item.get('source_doc', 'Palekar ZBNF'),
            'source_page': item.get('source_page', 0),
            'category': item.get('category', 'biofertiliser'),
            'crop_tag': item.get('crop_tag'),
            'zone_tag': item.get('zone_tag'),
            'language': item.get('language', 'en'),
        })

    print(f'  seed_chunks: {len(data)} records → {len(chunks)} chunks')
    return chunks


def ingest_vocab_glossary():
    """Convert vocab_glossary.json → searchable term chunks."""
    data = json.load(open(BASE / 'vocab_glossary.json'))
    chunks = []

    # Group vocab entries into batches of 10 for denser chunks
    entries = list(data) if isinstance(data, list) else [{'term': k, **v} for k, v in data.items()]

    for i in range(0, len(entries), 10):
        batch = entries[i:i + 10]
        text = "Agricultural Vocabulary (Kannada-English):\n"
        for entry in batch:
            if isinstance(entry, dict):
                term_en = entry.get('term_en', entry.get('term', entry.get('english', '')))
                term_kn = entry.get('term_kn', entry.get('kannada', ''))
                meaning = entry.get('meaning', entry.get('definition', ''))
                text += f"  {term_en} = {term_kn}: {meaning}\n"
            elif isinstance(entry, str):
                text += f"  {entry}\n"

        chunks.append({
            'content': text,
            'source_doc': 'KrishiMitra Vocabulary Glossary (Structured KB)',
            'source_page': i // 10 + 1,
            'category': 'organic_farming',
            'language': 'mixed',
        })

    print(f'  vocab_glossary: {len(entries)} terms → {len(chunks)} chunks')
    return chunks


if __name__ == '__main__':
    print('══════════════════════════════════════════════')
    print('  KrishiMitra — Structured Data Ingestion')
    print('══════════════════════════════════════════════\n')

    all_chunks = []

    print('📦 Converting structured data to chunks...')
    all_chunks.extend(ingest_organic_inputs())
    all_chunks.extend(ingest_mulching_plants())
    all_chunks.extend(ingest_disease_db())
    all_chunks.extend(ingest_soil_zones())
    all_chunks.extend(ingest_crop_list())
    all_chunks.extend(ingest_symptom_deficiency())
    all_chunks.extend(ingest_seed_chunks())
    all_chunks.extend(ingest_vocab_glossary())

    print(f'\n📊 Total chunks to embed: {len(all_chunks)}')
    print(f'\n🔄 Embedding and storing in Supabase...')

    total = embed_and_store(all_chunks)

    print(f'\n══════════════════════════════════════════════')
    print(f'  ✅ INGESTION COMPLETE: {total} new chunks stored')
    print(f'══════════════════════════════════════════════')
