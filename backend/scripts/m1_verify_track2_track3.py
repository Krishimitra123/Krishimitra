from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
RAW = BASE / "corpus" / "raw"
STRUCT = BASE / "corpus" / "structured"

required_raw = [
    "ICAR_Organic_Farming_eCourse.pdf",
    "ICAR_Soil_Fertility_Nutrient_Management.pdf",
    "TNAU_Organic_Farming_2024.pdf",
    "ZBNF_ResearchGate_2022.pdf",
    "NCDS_WP70_ZBNF_Karnataka.pdf",
    "NIPHM_IPM_Rice.pdf",
    "NIPHM_IPM_Tomato.pdf",
    "NIPHM_IPM_Cotton.pdf",
    "NIPHM_IPM_Chilli.pdf",
    "NIPHM_IPM_Groundnut.pdf",
    "NIPHM_IPM_Onion.pdf",
    "NIPHM_IPM_Banana.pdf",
]

required_struct = [
    "organic_inputs.json",
    "mulching_plants.json",
    "karnataka_soil_zones.json",
    "district_list.json",
    "crop_list.json",
    "karnataka_disease_db.json",
    "symptom_deficiency_data.json",
]

required_scripts = [
    BASE / "scripts" / "m0_ingest_rag.py",
    BASE / "scripts" / "benchmark_rag.py",
    BASE / "scripts" / "build_vocab_glossary.py",
]

required_modules = [
    BASE / "modules" / "m3_rag.py",
    BASE / "modules" / "m3_structured_kb.py",
]


def check_json_count(path: Path, expected: int | None = None) -> tuple[bool, int | None, str | None]:
    if not path.exists():
        return False, None, "missing"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            return False, None, "not a JSON array"
        count = len(data)
        if expected is not None and count != expected:
            return False, count, f"expected {expected}, got {count}"
        return True, count, None
    except Exception as exc:
        return False, None, str(exc)


def main() -> None:
    print("Track 2 + Track 3 Verification")
    print("=" * 40)

    print("\nRaw PDFs:")
    missing_raw = []
    for name in required_raw:
        p = RAW / name
        ok = p.exists() and p.stat().st_size > 1024
        print(f"- {'OK' if ok else 'MISSING'} {name}")
        if not ok:
            missing_raw.append(name)

    print("\nStructured JSONs:")
    missing_struct = []
    for name in required_struct:
        p = STRUCT / name
        ok = p.exists()
        print(f"- {'OK' if ok else 'MISSING'} {name}")
        if not ok:
            missing_struct.append(name)

    print("\nKey JSON count checks:")
    checks = [
        (STRUCT / "karnataka_soil_zones.json", 10),
        (STRUCT / "district_list.json", 31),
        (STRUCT / "karnataka_disease_db.json", 10),
        (STRUCT / "symptom_deficiency_data.json", 15),
        (BASE / "corpus" / "vocab_glossary.json", 300),
    ]
    failed_counts = []
    for path, exp in checks:
        ok, got, err = check_json_count(path, exp)
        if ok:
            print(f"- OK {path.name}: {got}")
        else:
            print(f"- FAIL {path.name}: {err}")
            failed_counts.append(path.name)

    print("\nScripts:")
    for p in required_scripts:
        print(f"- {'OK' if p.exists() else 'MISSING'} {p.name}")

    print("\nModules:")
    for p in required_modules:
        print(f"- {'OK' if p.exists() else 'MISSING'} {p.name}")

    print("\nSummary:")
    blockers = len(missing_raw) + len(missing_struct) + len(failed_counts)
    if blockers == 0:
        print("- Status: READY for ingestion + benchmark + Supabase checks")
    else:
        print(f"- Status: {blockers} blockers remaining")
        if missing_raw:
            print("- Missing raw PDFs: " + ", ".join(missing_raw))
        if missing_struct:
            print("- Missing structured files: " + ", ".join(missing_struct))
        if failed_counts:
            print("- JSON count issues: " + ", ".join(failed_counts))


if __name__ == "__main__":
    main()
