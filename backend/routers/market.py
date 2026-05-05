"""
Market Router — Karnataka Mandi Prices (Curated + Data.gov.in-ready)
Endpoints:
  GET /api/market/prices?district={d}&commodity={c} — Current prices
  GET /api/market/commodities                       — Available commodities
  GET /api/market/districts                         — Karnataka market districts

Strategy:
  - IMMEDIATE: Curated Karnataka mandi price data (JSON) updated from public APMC data
  - FUTURE: Direct Data.gov.in API integration (when API key arrives, ~3 days)

The curated data is sourced from Agmarknet (agmarknet.gov.in) public records.
Cache TTL: 6 hours for live API, curated data served directly.
"""

import json
import os
import time
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix='/api/market', tags=['market'])

# ── Load curated mandi data ──────────────────────────────────────
PRICES_PATH = Path(__file__).parent.parent / 'corpus' / 'structured' / 'karnataka_mandi_prices.json'
_prices_data: dict = {}

if PRICES_PATH.exists():
    _prices_data = json.loads(PRICES_PATH.read_text(encoding='utf-8'))
    print(f'[Market] Loaded curated mandi price data')

# ── Cache for live API ───────────────────────────────────────────
_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL = 21600  # 6 hours


def _get_cache(key: str) -> Optional[dict]:
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _set_cache(key: str, data: dict):
    _cache[key] = (time.time(), data)


async def _fetch_from_data_gov(state: str, district: str, commodity: str) -> Optional[dict]:
    """
    Fetch live prices from Data.gov.in API.
    Requires DATA_GOV_API_KEY environment variable.
    Falls back to curated data if key not available.
    """
    api_key = os.environ.get('DATA_GOV_API_KEY', '').strip()
    if not api_key:
        return None

    url = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070'
    params = {
        'api-key': api_key,
        'format': 'json',
        'limit': 20,
        'filters[state]': state,
    }
    if district:
        params['filters[district]'] = district
    if commodity:
        params['filters[commodity]'] = commodity

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)

        if resp.status_code == 200:
            data = resp.json()
            records = data.get('records', [])
            return {
                'source': 'Data.gov.in (Official)',
                'count': len(records),
                'records': [
                    {
                        'market': r.get('market', ''),
                        'commodity': r.get('commodity', ''),
                        'variety': r.get('variety', ''),
                        'min_price': r.get('min_price', ''),
                        'max_price': r.get('max_price', ''),
                        'modal_price': r.get('modal_price', ''),
                        'arrival_date': r.get('arrival_date', ''),
                        'district': r.get('district', ''),
                        'state': r.get('state', ''),
                    }
                    for r in records
                ],
            }
        else:
            print(f'[Market] Data.gov.in error: {resp.status_code}')
            return None

    except Exception as e:
        print(f'[Market] Data.gov.in fetch failed: {e}')
        return None


@router.get('/prices')
async def get_prices(
    district: Optional[str] = Query(None, description='Karnataka district'),
    commodity: Optional[str] = Query(None, description='Crop/commodity name'),
):
    """
    Get mandi prices for Karnataka crops.
    Tries Data.gov.in first (if API key set), falls back to curated data.
    """
    cache_key = f'market_{district or "all"}_{commodity or "all"}'
    cached = _get_cache(cache_key)
    if cached:
        return cached

    # Try live Data.gov.in API first
    live_data = await _fetch_from_data_gov('Karnataka', district or '', commodity or '')
    if live_data and live_data.get('count', 0) > 0:
        _set_cache(cache_key, live_data)
        return live_data

    # Fall back to curated data
    prices = _prices_data.get('prices', [])

    # Filter by district
    if district:
        d_lower = district.lower().strip()
        prices = [p for p in prices if d_lower in p.get('district', '').lower()]

    # Filter by commodity
    if commodity:
        c_lower = commodity.lower().strip()
        prices = [
            p for p in prices
            if c_lower in p.get('commodity', '').lower()
            or c_lower in p.get('commodity_kn', '').lower()
        ]

    result = {
        'source': 'Curated from Agmarknet/APMC public data (Data.gov.in API pending approval)',
        'last_updated': _prices_data.get('last_updated', '2026-05-01'),
        'count': len(prices),
        'records': prices[:20],
        'note': 'ಈ ಬೆಲೆಗಳು ಸೂಚಕ ಮಾತ್ರ. ನಿಖರ ಬೆಲೆಗೆ ನಿಮ್ಮ ಸ್ಥಳೀಯ APMC ಸಂಪರ್ಕಿಸಿ.',
    }

    _set_cache(cache_key, result)
    return result


@router.get('/commodities')
async def list_commodities():
    """List all commodities tracked in the market data."""
    prices = _prices_data.get('prices', [])
    commodities = set()
    for p in prices:
        commodities.add(p.get('commodity', ''))

    return {
        'commodities': sorted(list(commodities)),
        'count': len(commodities),
    }


@router.get('/districts')
async def list_market_districts():
    """List all districts with market data."""
    prices = _prices_data.get('prices', [])
    districts = set()
    for p in prices:
        districts.add(p.get('district', ''))

    return {
        'districts': sorted(list(districts)),
        'count': len(districts),
    }
