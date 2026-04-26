"""
RAG Benchmark Test — Verify retrieval accuracy before deployment.
Usage: python scripts/benchmark_rag.py

Pass criterion: top-3 retrieval accuracy >= 90% on test set (≥27/30 queries pass).
"""

import os
import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from models.schemas import NLPResult, Intent

# ── Benchmark Test Queries ───────────────────────────────────────

BENCHMARK_QUERIES = [
    {
        'query': 'jeevamrutha preparation method ingredients',
        'expected_source_keyword': 'ZBNF',
        'intent': Intent.BIOFERTILISER,
    },
    {
        'query': 'Karnataka soil zinc deficiency organic correction',
        'expected_source_keyword': 'Soil Fertility',
        'intent': Intent.SOIL_QUERY,
    },
    {
        'query': 'Panchagavya preparation ratio cow dung',
        'expected_source_keyword': 'ICAR Organic',
        'intent': Intent.BIOFERTILISER,
    },
    {
        'query': 'Paddy stem borer organic management neem',
        'expected_source_keyword': 'NIPHM',
        'intent': Intent.PEST_DISEASE,
    },
    {
        'query': 'vermicompost nitrogen content application dose',
        'expected_source_keyword': 'ICAR',
        'intent': Intent.BIOFERTILISER,
    },
    {
        'query': 'beejamrutha seed treatment organic method',
        'expected_source_keyword': 'ZBNF',
        'intent': Intent.BIOFERTILISER,
    },
    {
        'query': 'organic certification NPOP process India',
        'expected_source_keyword': 'certification',
        'intent': Intent.CERTIFICATION,
    },
    {
        'query': 'green manure dhaincha sunhemp soil improvement',
        'expected_source_keyword': 'Soil',
        'intent': Intent.SOIL_QUERY,
    },
    {
        'query': 'neem extract pest control organic spray',
        'expected_source_keyword': 'IPM',
        'intent': Intent.PEST_DISEASE,
    },
    {
        'query': 'crop rotation benefits organic farming',
        'expected_source_keyword': 'ICAR',
        'intent': Intent.CROP_ADVICE,
    },
    # Add more queries to reach 30 total for production benchmarks
]


async def run_benchmark():
    """Run all benchmark queries and report accuracy."""
    from modules.m3_rag import retrieve

    passed = 0
    failed = 0
    results = []

    for i, bq in enumerate(BENCHMARK_QUERIES, 1):
        nlp_result = NLPResult(
            raw_transcript=bq['query'],
            normalised_query=bq['query'],
            detected_language='en',
            intent=bq['intent'],
            confidence=0.9,
            entities={},
            enriched_query=bq['query'],
            routing=['rag'],
        )

        chunks = await retrieve(nlp_result)

        # Check if expected source appears in top-3 results
        top3_sources = [c.source_doc for c in chunks[:3]]
        found = any(bq['expected_source_keyword'].lower() in s.lower()
                     for s in top3_sources)

        status = '✅ PASS' if found else '❌ FAIL'
        if found:
            passed += 1
        else:
            failed += 1

        results.append({
            'query': bq['query'][:50],
            'expected': bq['expected_source_keyword'],
            'got': top3_sources,
            'status': status,
        })

        print(f'  [{i}/{len(BENCHMARK_QUERIES)}] {status}: "{bq["query"][:40]}..."')

    # Summary
    total = passed + failed
    accuracy = (passed / total * 100) if total > 0 else 0
    print(f'\n{"=" * 60}')
    print(f'BENCHMARK RESULTS: {passed}/{total} passed ({accuracy:.1f}%)')
    print(f'Target: ≥90% accuracy')
    print(f'Status: {"✅ PASSED" if accuracy >= 90 else "❌ FAILED"}')
    print(f'{"=" * 60}')

    return accuracy >= 90


if __name__ == '__main__':
    print('🔬 KrishiMitra RAG Benchmark Test')
    print('=' * 60)

    success = asyncio.run(run_benchmark())
    sys.exit(0 if success else 1)
