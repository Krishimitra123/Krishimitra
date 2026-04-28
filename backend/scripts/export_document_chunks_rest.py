#!/usr/bin/env python3
"""Export document_chunks via Supabase REST API (no supabase SDK required)."""

from __future__ import annotations

import json
import os
from pathlib import Path

import requests


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def main() -> None:
    # Prefer KrishiMitra backend .env, fallback to current farming-ai backend .env.
    candidate_envs = [
        Path(__file__).resolve().parents[1] / ".env",
        Path("c:/Users/asus/farming-ai/backend/.env"),
    ]
    for env_path in candidate_envs:
        load_env_file(env_path)

    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or ""
    )

    if not supabase_url or not supabase_key:
        raise SystemExit("Missing SUPABASE_URL or key in environment/.env")

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Accept": "application/json",
    }

    base_url = f"{supabase_url}/rest/v1/document_chunks"
    records: list[dict] = []
    batch_size = 1000
    offset = 0

    print("Exporting document_chunks via REST...")
    while True:
        params = {
            "select": "*",
            "order": "id.asc",
        }
        range_headers = headers | {
            "Range-Unit": "items",
            "Range": f"{offset}-{offset + batch_size - 1}",
        }
        response = requests.get(base_url, headers=range_headers, params=params, timeout=60)
        if response.status_code >= 400:
            print(f"Supabase error {response.status_code}: {response.text}")
            response.raise_for_status()
        batch = response.json()
        if not batch:
            break
        records.extend(batch)
        print(f"  fetched {len(batch)} rows (total {len(records)})")
        offset += batch_size

    out_path = Path(__file__).resolve().parents[2] / "document_chunks_export.json"
    payload = {
        "metadata": {
            "table": "document_chunks",
            "record_count": len(records),
            "source": supabase_url,
        },
        "records": records,
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    print(f"Export complete: {out_path}")
    print(f"Records: {len(records)}")


if __name__ == "__main__":
    main()
