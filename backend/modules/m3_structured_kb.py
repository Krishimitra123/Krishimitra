# backend/modules/m3_structured_kb.py
from __future__ import annotations
import os
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value

_supabase: Client = create_client(
    _require_env("SUPABASE_URL"),
    os.getenv("SUPABASE_ANON_KEY") or _require_env("SUPABASE_KEY")
)

def get_organic_input(query: str) -> Optional[dict]:
    query_lower = query.lower().strip()
    response = _supabase.table("organic_inputs") \
        .select("*") \
        .or_(f"name_en.ilike.%{query_lower}%,transliteration.ilike.%{query_lower}%") \
        .limit(1) \
        .execute()
    return response.data[0] if response.data else None

def get_mulching_plant(query: str) -> Optional[dict]:
    query_lower = query.lower().strip()
    response = _supabase.table("mulching_plants") \
        .select("*") \
        .or_(f"name_en.ilike.%{query_lower}%,transliteration.ilike.%{query_lower}%") \
        .limit(1) \
        .execute()
    return response.data[0] if response.data else None

def format_recipe_for_response(record: dict) -> str:
    lines = []
    lines.append(f"## {record.get('name_en','')} ({record.get('name_kn','')})")
    lines.append("")

    for ing in record.get("ingredients", []):
        qty  = ing.get("quantity", "")
        unit = ing.get("unit", "")
        item = ing.get("item", "")
        note = ing.get("notes", "")
        line = f"- {qty} {unit} {item}".strip()
        if note:
            line += f" *({note})*"
        lines.append(line)
    lines.append("")

    for i, step in enumerate(record.get("preparation_steps_en", []), 1):
        lines.append(f"{i}. {step}")
    lines.append("")

    if record.get("application_rate"):
        lines.append(f"**Rate:** {record['application_rate']}")
    if record.get("application_timing"):
        lines.append(f"**Timing:** {record['application_timing']}")
    lines.append("")

    for w in record.get("critical_warnings", []):
        lines.append(f"⚠️ {w}")

    if record.get("primary_source"):
        lines.append(f"\n*Source: {record['primary_source']}*")

    return "\n".join(lines)

if __name__ == "__main__":
    print("Testing organic_inputs table...")
    r = get_organic_input("jeevamrutha")
    print(format_recipe_for_response(r) if r else "Table empty — needs data loaded")

    print("\nTesting mulching_plants table...")
    p = get_mulching_plant("gliricidia")
    print(p if p else "Table empty — needs data loaded")