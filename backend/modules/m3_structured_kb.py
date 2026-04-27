"""
M3 Structured Knowledge Base — queries structured tables in Supabase
(organic_inputs, mulching_plants) and formats results for LLM context.
"""

import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from supabase import create_client, Client

# ── Supabase client (shared singleton) ───────────────────────────────────────

_supabase: Optional[Client] = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_KEY"]
        _supabase = create_client(url, key)
    return _supabase


# ── Organic Inputs ────────────────────────────────────────────────────────────

def get_organic_input(query: str) -> Optional[dict]:
    """
    Search organic_inputs table for a matching record.
    Matches against name_en and transliteration fields (case-insensitive).

    Args:
        query: Search term e.g. "jeevamrutha", "beejamrutha", "vermicompost"

    Returns:
        First matching record dict, or None if not found.
    """
    sb = _get_supabase()
    try:
        result = (
            sb.table("organic_inputs")
            .select("*")
            .ilike("name_en", f"%{query}%")
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]

        # Try transliteration field if name_en didn't match
        result2 = (
            sb.table("organic_inputs")
            .select("*")
            .ilike("transliteration", f"%{query}%")
            .limit(1)
            .execute()
        )
        return result2.data[0] if result2.data else None

    except Exception as e:
        print(f"[KB] get_organic_input error: {e}")
        return None


# ── Mulching Plants ───────────────────────────────────────────────────────────

def get_mulching_plant(query: str) -> Optional[dict]:
    """
    Search mulching_plants table for a matching record.
    Matches against name_en and transliteration fields (case-insensitive).

    Args:
        query: Search term e.g. "gliricidia", "sesbania", "moringa"

    Returns:
        First matching record dict, or None if not found.
    """
    sb = _get_supabase()
    try:
        result = (
            sb.table("mulching_plants")
            .select("*")
            .ilike("name_en", f"%{query}%")
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]

        result2 = (
            sb.table("mulching_plants")
            .select("*")
            .ilike("transliteration", f"%{query}%")
            .limit(1)
            .execute()
        )
        return result2.data[0] if result2.data else None

    except Exception as e:
        print(f"[KB] get_mulching_plant error: {e}")
        return None


# ── Recipe Formatter ──────────────────────────────────────────────────────────

def format_recipe_for_response(record: dict) -> str:
    """
    Format an OrganicInput record into structured text for the LLM prompt.

    Expected record fields (all optional except name_en):
        name_en, name_kn, transliteration,
        ingredients (list of {item, quantity, unit}),
        preparation_steps (list of strings),
        application_rate, application_timing,
        warnings (list of strings),
        source_citation
    """
    lines = []

    # Header
    name_en = record.get("name_en", "Organic Input")
    name_kn = record.get("name_kn", "")
    trans = record.get("transliteration", "")

    header_parts = [name_en]
    if name_kn:
        header_parts.append(name_kn)
    if trans and trans != name_en:
        header_parts.append(f"({trans})")
    lines.append("━━ " + " / ".join(header_parts) + " ━━")
    lines.append("")

    # Ingredients
    ingredients = record.get("ingredients", [])
    if ingredients:
        lines.append("📋 Ingredients:")
        for ing in ingredients:
            if isinstance(ing, dict):
                item = ing.get("item", "")
                qty = ing.get("quantity", "")
                unit = ing.get("unit", "")
                qty_str = f"{qty} {unit}".strip() if qty else ""
                if qty_str:
                    lines.append(f"  • {item}: {qty_str}")
                else:
                    lines.append(f"  • {item}")
            else:
                lines.append(f"  • {ing}")
        lines.append("")

    # Preparation steps
    steps = record.get("preparation_steps", [])
    if steps:
        lines.append("🔧 Preparation:")
        for i, step in enumerate(steps, 1):
            if isinstance(step, str):
                lines.append(f"  {i}. {step}")
                continue
            lines.append(f"  {i}. {step}")
        lines.append("")

    # Application
    app_rate = record.get("application_rate", "")
    app_timing = record.get("application_timing", "")
    if app_rate or app_timing:
        lines.append("🌱 Application:")
        if app_rate:
            lines.append(f"  • Rate: {app_rate}")
        if app_timing:
            lines.append(f"  • Timing: {app_timing}")
        lines.append("")

    # Warnings
    warnings = record.get("warnings", [])
    if warnings:
        lines.append("⚠️  Warnings:")
        for w in warnings:
            lines.append(f"  • {w}")
        lines.append("")

    # Source citation
    source = record.get("source_citation", "")
    if source:
        lines.append(f"📚 Source: {source}")

    return "\n".join(lines)


# ── Knowledge Graph Helpers ───────────────────────────────────────────────────

def get_deficiencies_for_symptom(symptom: str) -> list[dict]:
    """
    Query symptom_deficiency_links for probable deficiencies
    given an observed symptom.

    Returns list of {deficiency, probability} sorted by probability desc.
    """
    sb = _get_supabase()
    try:
        result = (
            sb.table("symptom_deficiency_links")
            .select("deficiency, probability")
            .ilike("symptom", f"%{symptom}%")
            .order("probability", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as e:
        print(f"[KB] get_deficiencies_for_symptom error: {e}")
        return []


def get_deficiencies_for_zone(zone_id: int) -> list[dict]:
    """
    Query zone_deficiency_links for common deficiencies in a zone.

    Returns list of {deficiency, prevalence_pct} sorted by prevalence desc.
    """
    sb = _get_supabase()
    try:
        result = (
            sb.table("zone_deficiency_links")
            .select("deficiency, prevalence_pct")
            .eq("zone_id", zone_id)
            .order("prevalence_pct", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as e:
        print(f"[KB] get_deficiencies_for_zone error: {e}")
        return []


def get_corrections_for_deficiency(deficiency: str) -> list[dict]:
    """
    Query deficiency_correction_links for organic corrections.

    Returns list of {correction, effectiveness} with primary first.
    """
    sb = _get_supabase()
    try:
        result = (
            sb.table("deficiency_correction_links")
            .select("correction, effectiveness")
            .ilike("deficiency", f"%{deficiency}%")
            .execute()
        )
        data = result.data or []
        # Sort: primary first, then secondary
        data.sort(key=lambda x: 0 if x.get("effectiveness") == "primary" else 1)
        return data
    except Exception as e:
        print(f"[KB] get_corrections_for_deficiency error: {e}")
        return []


# ── Quick smoke test ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Testing get_organic_input('jeevamrutha'):")
    record = get_organic_input("jeevamrutha")
    if record:
        print(format_recipe_for_response(record))
    else:
        print("  Not found in organic_inputs table (table may be empty)")

    print("\nTesting get_deficiencies_for_symptom('yellowing'):")
    deficiencies = get_deficiencies_for_symptom("yellowing")
    for d in deficiencies:
        print(f"  {d['deficiency']} — {d['probability']}")

    print("\nTesting get_deficiencies_for_zone(5):")
    zone_defs = get_deficiencies_for_zone(5)
    for d in zone_defs:
        print(f"  {d['deficiency']} — {d['prevalence_pct']}%")
