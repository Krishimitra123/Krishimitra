"""
Soil Router — SoilGrids (ISRIC) + Local Karnataka Data Integration (FREE, no API key)
Endpoints:
  GET /api/soil?district={name}          — Soil data by district
  GET /api/soil?lat={lat}&lon={lon}      — Soil data by coordinates
  GET /api/soil/zone/{zone_id}           — Karnataka zone-specific data
  GET /api/soil/zones                    — All Karnataka soil zones

Combines:
  - SoilGrids REST API (250m resolution, global, free)
  - Local karnataka_soil_zones.json (expert-curated zone data)

Cache TTL: 24 hours (soil doesn't change frequently).
"""

import json
import time
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix='/api/soil', tags=['soil'])

# ── Load local zone data ─────────────────────────────────────────
ZONES_PATH = Path(__file__).parent.parent / 'corpus' / 'structured' / 'karnataka_soil_zones.json'
_zones: list[dict] = []

if ZONES_PATH.exists():
    _zones = json.loads(ZONES_PATH.read_text(encoding='utf-8'))
    print(f'[Soil] Loaded {len(_zones)} Karnataka soil zones')

# ── District → zone mapping ─────────────────────────────────────
DISTRICT_ZONE_MAP: dict[str, int] = {}
DISTRICT_COORDS: dict[str, tuple[float, float]] = {
    'bagalkot':         (16.18, 75.69),
    'ballari':          (15.14, 76.92),
    'belagavi':         (15.85, 74.50),
    'bengaluru rural':  (13.23, 77.71),
    'bengaluru urban':  (12.97, 77.59),
    'bidar':            (17.91, 77.52),
    'chamarajanagar':   (11.93, 76.94),
    'chikkaballapur':   (13.44, 77.73),
    'chikkamagaluru':   (13.32, 75.77),
    'chitradurga':      (14.23, 76.40),
    'dakshina kannada': (12.87, 74.88),
    'davangere':        (14.47, 75.92),
    'dharwad':          (15.46, 75.01),
    'gadag':            (15.43, 75.63),
    'hassan':           (13.01, 76.10),
    'haveri':           (14.79, 75.40),
    'kalaburagi':       (17.33, 76.83),
    'kodagu':           (12.42, 75.74),
    'kolar':            (13.14, 78.13),
    'koppal':           (15.35, 76.15),
    'mandya':           (12.52, 76.90),
    'mysuru':           (12.30, 76.66),
    'raichur':          (16.21, 77.36),
    'ramanagara':       (12.72, 77.28),
    'shivamogga':       (13.93, 75.57),
    'tumakuru':         (13.34, 77.10),
    'udupi':            (13.34, 74.75),
    'uttara kannada':   (14.68, 74.69),
    'vijayapura':       (16.83, 75.71),
    'yadgir':           (16.77, 77.14),
    'vijayanagara':     (15.34, 76.47),
}

for zone in _zones:
    for d in zone.get('districts', []):
        DISTRICT_ZONE_MAP[d.lower().strip()] = zone['zone_id']

# ── Cache ────────────────────────────────────────────────────────
_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL = 86400  # 24 hours


def _get_cache(key: str) -> Optional[dict]:
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _set_cache(key: str, data: dict):
    _cache[key] = (time.time(), data)


def _find_zone(district: str) -> Optional[dict]:
    """Find zone data for a district."""
    key = district.lower().strip()
    zone_id = DISTRICT_ZONE_MAP.get(key)
    if zone_id:
        for z in _zones:
            if z['zone_id'] == zone_id:
                return z
    # Fuzzy match
    for dk, did in DISTRICT_ZONE_MAP.items():
        if key in dk or dk in key:
            for z in _zones:
                if z['zone_id'] == did:
                    return z
    return None


def _resolve_coords(district: Optional[str], lat: Optional[float], lon: Optional[float]) -> tuple[float, float, str]:
    if lat is not None and lon is not None:
        return lat, lon, district or 'Custom'
    if district:
        key = district.lower().strip()
        if key in DISTRICT_COORDS:
            c = DISTRICT_COORDS[key]
            return c[0], c[1], district
        for dk, dv in DISTRICT_COORDS.items():
            if key in dk or dk in key:
                return dv[0], dv[1], dk.title()
        raise HTTPException(status_code=404, detail=f'District "{district}" not found.')
    raise HTTPException(status_code=400, detail='Provide district or lat/lon.')


async def _fetch_soilgrids(lat: float, lon: float) -> Optional[dict]:
    """Fetch soil data from SoilGrids ISRIC REST API (free, no key)."""
    # SoilGrids properties: pH, nitrogen, organic carbon, clay, sand, silt
    properties = ['phh2o', 'nitrogen', 'soc', 'clay', 'sand', 'silt']
    depths = ['0-5cm', '5-15cm', '15-30cm']
    values = ['mean']

    params = {
        'lat': lat,
        'lon': lon,
        'property': properties,
        'depth': depths,
        'value': values,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                'https://rest.isric.org/soilgrids/v2.0/properties/query',
                params=params,
            )

        if resp.status_code != 200:
            print(f'[Soil] SoilGrids error: {resp.status_code} — {resp.text[:200]}')
            return None

        data = resp.json()
        layers = data.get('properties', {}).get('layers', [])

        parsed = {}
        for layer in layers:
            prop_name = layer.get('name', '')
            prop_unit = layer.get('unit_measure', {}).get('mapped_units', '')
            depths_data = layer.get('depths', [])
            depth_values = {}
            for d in depths_data:
                label = d.get('label', '')
                val = d.get('values', {}).get('mean')
                if val is not None:
                    # SoilGrids returns values with conversion factors
                    if prop_name == 'phh2o':
                        val = val / 10.0  # pH is stored as pH * 10
                    elif prop_name in ('nitrogen', 'soc'):
                        val = val / 100.0  # g/kg → g/100g adjustment
                    depth_values[label] = round(val, 2)
            parsed[prop_name] = {
                'unit': prop_unit,
                'depths': depth_values,
            }

        return parsed

    except Exception as e:
        print(f'[Soil] SoilGrids fetch failed: {e}')
        return None


@router.get('')
async def get_soil_data(
    district: Optional[str] = Query(None, description='Karnataka district name'),
    lat: Optional[float] = Query(None, description='Latitude'),
    lon: Optional[float] = Query(None, description='Longitude'),
):
    """
    Get comprehensive soil data combining SoilGrids (global) + Karnataka zone data (local).
    Free, no API key needed. Cached 24 hours.
    """
    lat_val, lon_val, district_name = _resolve_coords(district, lat, lon)
    cache_key = f'soil_{lat_val:.2f}_{lon_val:.2f}'

    cached = _get_cache(cache_key)
    if cached:
        return cached

    # Fetch SoilGrids data (async)
    soilgrids = await _fetch_soilgrids(lat_val, lon_val)

    # Get local zone data
    zone_data = _find_zone(district_name) if district else None

    result = {
        'district': district_name,
        'latitude': lat_val,
        'longitude': lon_val,
        'soilgrids_data': soilgrids or {},
        'karnataka_zone': zone_data or {},
        'organic_recommendations': _get_organic_recommendations(zone_data, soilgrids),
        'source': 'SoilGrids ISRIC (250m resolution) + Karnataka Agricultural University zone data',
    }

    _set_cache(cache_key, result)
    return result


@router.get('/zone/{zone_id}')
async def get_zone_data(zone_id: int):
    """Get Karnataka agro-climatic zone data by zone ID (1-10)."""
    for z in _zones:
        if z['zone_id'] == zone_id:
            return z
    raise HTTPException(status_code=404, detail=f'Zone {zone_id} not found. Valid range: 1-10.')


@router.get('/zones')
async def list_zones():
    """List all Karnataka soil zones."""
    return {'zones': _zones, 'count': len(_zones)}


def _get_organic_recommendations(zone_data: Optional[dict], soilgrids: Optional[dict]) -> list[str]:
    """Generate organic farming recommendations based on soil data."""
    recs = []

    if zone_data:
        deficiencies = zone_data.get('key_deficiencies', [])
        if 'N' in deficiencies:
            recs.append('ಸಾರಜನಕ ಕೊರತೆ ಇದೆ. ಜೀವಾಮೃತ ಪ್ರತಿ 15 ದಿನಕ್ಕೊಮ್ಮೆ ಹಾಕಿ, ಸೆಣಬು/ಅಗಸೆ ಹಸಿರು ಎಲೆ ಗೊಬ್ಬರ ಬೆಳೆಸಿ.')
        if 'Zn' in deficiencies:
            recs.append('ಸತುವು ಕೊರತೆ ಸಾಮಾನ್ಯ. ಎರೆಹುಳು ಗೊಬ್ಬರ ಮತ್ತು ಪಂಚಗವ್ಯ ಬಳಸಿ.')
        if 'P' in deficiencies:
            recs.append('ರಂಜಕ ಕೊರತೆ ಇದೆ. ಮೈಕೋರೈಜಾ ಶಿಲೀಂಧ್ರ ಮತ್ತು ರಂಜಕ ಕರಗಿಸುವ ಬ್ಯಾಕ್ಟೀರಿಯಾ ಬಳಸಿ.')
        if 'Fe' in deficiencies:
            recs.append('ಕಬ್ಬಿಣ ಕೊರತೆ ಇದೆ. ಗೋಮೂತ್ರ ಆಧಾರಿತ ಎಲೆ ಸಿಂಪರಣೆ ಮಾಡಿ.')
        if 'B' in deficiencies:
            recs.append('ಬೋರಾನ್ ಕೊರತೆ ಇದೆ. ಬೂದಿ ಮತ್ತು ಎರೆಹುಳು ಗೊಬ್ಬರ ಹಾಕಿ.')

        om = zone_data.get('organic_matter_typical', '')
        if om and '0.2' in om or '0.3' in om:
            recs.append('ಸಾವಯವ ಪದಾರ್ಥ ಬಹಳ ಕಡಿಮೆ. ಗ್ಲಿರಿಸಿಡಿಯಾ/ನುಗ್ಗೆ ಮಲ್ಚಿಂಗ್ ತುರ್ತಾಗಿ ಶುರು ಮಾಡಿ.')

    if soilgrids:
        ph_data = soilgrids.get('phh2o', {}).get('depths', {})
        top_ph = ph_data.get('0-5cm', None)
        if top_ph:
            if top_ph > 8.0:
                recs.append(f'ಮಣ್ಣಿನ pH {top_ph} — ಕ್ಷಾರೀಯ. ಜಿಪ್ಸಂ ಬದಲು ಹುಳಿ ಮಜ್ಜಿಗೆ / ಮಜ್ಜಿಗೆ ಗೊಬ್ಬರ ಬಳಸಿ.')
            elif top_ph < 5.5:
                recs.append(f'ಮಣ್ಣಿನ pH {top_ph} — ಆಮ್ಲೀಯ. ಬೂದಿ ಮತ್ತು ಸುಣ್ಣ ಹಾಕಿ (ಡೋಲಮೈಟ್).')

    if not recs:
        recs.append('ಮಣ್ಣಿನ ಆರೋಗ್ಯ ಸಮಂಜಸವಾಗಿದೆ. ನಿಯಮಿತ ಜೀವಾಮೃತ ಮತ್ತು ಮಲ್ಚಿಂಗ್ ಮುಂದುವರಿಸಿ.')

    return recs
