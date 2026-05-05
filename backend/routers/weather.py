"""
Weather Router — Open-Meteo Integration (FREE, no API key)
Endpoints:
  GET /api/weather?district={name}          — Weather by Karnataka district
  GET /api/weather?lat={lat}&lon={lon}      — Weather by coordinates
  GET /api/weather/agriculture?district={d} — Agriculture-specific data (soil temp, moisture, ET)

Cache TTL: 1 hour for current weather, 6 hours for agriculture data.
"""

import asyncio
import time
from typing import Optional
import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix='/api/weather', tags=['weather'])

# ── Karnataka District Coordinates ────────────────────────────────
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

# ── In-memory cache ──────────────────────────────────────────────
_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL_WEATHER = 3600      # 1 hour
CACHE_TTL_AGRICULTURE = 21600  # 6 hours


def _get_cache(key: str, ttl: int) -> Optional[dict]:
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < ttl:
            return data
    return None


def _set_cache(key: str, data: dict):
    _cache[key] = (time.time(), data)


def _resolve_coords(district: Optional[str], lat: Optional[float], lon: Optional[float]) -> tuple[float, float, str]:
    """Resolve coordinates from district name or direct lat/lon."""
    if lat is not None and lon is not None:
        district_name = district or 'Custom Location'
        return lat, lon, district_name

    if district:
        key = district.lower().strip()
        if key in DISTRICT_COORDS:
            coords = DISTRICT_COORDS[key]
            return coords[0], coords[1], district
        # Fuzzy match
        for dk, dv in DISTRICT_COORDS.items():
            if key in dk or dk in key:
                return dv[0], dv[1], dk.title()
        raise HTTPException(status_code=404, detail=f'District "{district}" not found. Use a Karnataka district name.')

    raise HTTPException(status_code=400, detail='Provide either district or lat/lon parameters.')


@router.get('')
async def get_weather(
    district: Optional[str] = Query(None, description='Karnataka district name'),
    lat: Optional[float] = Query(None, description='Latitude'),
    lon: Optional[float] = Query(None, description='Longitude'),
):
    """
    Get current weather + 7-day forecast for a Karnataka district or coordinates.
    Data from Open-Meteo (free, no API key). Cached for 1 hour.
    """
    lat_val, lon_val, district_name = _resolve_coords(district, lat, lon)
    cache_key = f'weather_{lat_val:.2f}_{lon_val:.2f}'

    cached = _get_cache(cache_key, CACHE_TTL_WEATHER)
    if cached:
        print(f'[Weather] Cache hit for {district_name}')
        return cached

    url = (
        f'https://api.open-meteo.com/v1/forecast'
        f'?latitude={lat_val}&longitude={lon_val}'
        f'&current=temperature_2m,relative_humidity_2m,apparent_temperature,'
        f'precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m'
        f'&daily=weather_code,temperature_2m_max,temperature_2m_min,'
        f'precipitation_sum,rain_sum,sunrise,sunset,uv_index_max'
        f'&timezone=Asia/Kolkata'
        f'&forecast_days=7'
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)

        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f'Open-Meteo error: {resp.status_code}')

        data = resp.json()
        result = {
            'district': district_name,
            'latitude': lat_val,
            'longitude': lon_val,
            'current': data.get('current', {}),
            'current_units': data.get('current_units', {}),
            'daily': data.get('daily', {}),
            'daily_units': data.get('daily_units', {}),
            'source': 'Open-Meteo (free, no API key)',
        }
        _set_cache(cache_key, result)
        print(f'[Weather] Fetched for {district_name}: {data.get("current", {}).get("temperature_2m")}°C')
        return result

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail='Weather API timeout')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Weather fetch failed: {str(e)}')


@router.get('/agriculture')
async def get_agriculture_weather(
    district: Optional[str] = Query(None, description='Karnataka district name'),
    lat: Optional[float] = Query(None, description='Latitude'),
    lon: Optional[float] = Query(None, description='Longitude'),
):
    """
    Agriculture-specific weather: soil temperature, soil moisture, evapotranspiration.
    Critical for organic farming decisions (Jeevamrutha application timing, mulching schedule).
    Cached for 6 hours.
    """
    lat_val, lon_val, district_name = _resolve_coords(district, lat, lon)
    cache_key = f'agri_{lat_val:.2f}_{lon_val:.2f}'

    cached = _get_cache(cache_key, CACHE_TTL_AGRICULTURE)
    if cached:
        return cached

    url = (
        f'https://api.open-meteo.com/v1/forecast'
        f'?latitude={lat_val}&longitude={lon_val}'
        f'&hourly=soil_temperature_0cm,soil_temperature_6cm,'
        f'soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,'
        f'evapotranspiration,rain'
        f'&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,'
        f'et0_fao_evapotranspiration'
        f'&timezone=Asia/Kolkata'
        f'&forecast_days=7'
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)

        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f'Open-Meteo error: {resp.status_code}')

        data = resp.json()
        result = {
            'district': district_name,
            'latitude': lat_val,
            'longitude': lon_val,
            'hourly': data.get('hourly', {}),
            'hourly_units': data.get('hourly_units', {}),
            'daily': data.get('daily', {}),
            'daily_units': data.get('daily_units', {}),
            'source': 'Open-Meteo Agriculture (free)',
            'farming_tips': _generate_farming_tips(data),
        }
        _set_cache(cache_key, result)
        return result

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail='Agriculture weather API timeout')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Agriculture weather fetch failed: {str(e)}')


@router.get('/districts')
async def list_districts():
    """List all Karnataka districts available for weather lookup."""
    return {
        'districts': [
            {'name': k.title(), 'lat': v[0], 'lon': v[1]}
            for k, v in sorted(DISTRICT_COORDS.items())
        ],
        'count': len(DISTRICT_COORDS),
    }


def _generate_farming_tips(data: dict) -> list[str]:
    """Generate agriculture-relevant tips based on weather data."""
    tips = []
    daily = data.get('daily', {})
    precip = daily.get('precipitation_sum', [])
    temps_max = daily.get('temperature_2m_max', [])

    if precip and sum(precip[:3]) > 20:
        tips.append('ಮುಂದಿನ 3 ದಿನಗಳಲ್ಲಿ ಉತ್ತಮ ಮಳೆ ನಿರೀಕ್ಷಿತ. ಜೀವಾಮೃತ ಹಾಕಲು ಸೂಕ್ತ ಸಮಯ.')
    elif precip and sum(precip[:3]) < 2:
        tips.append('ಮುಂದಿನ 3 ದಿನ ಮಳೆ ಇಲ್ಲ. ಮಲ್ಚಿಂಗ್ ಮಾಡಿ ತೇವಾಂಶ ಉಳಿಸಿ.')

    if temps_max and max(temps_max[:3]) > 38:
        tips.append('ಅತಿ ಹೆಚ್ಚು ಉಷ್ಣಾಂಶ ನಿರೀಕ್ಷಿತ. ಬೆಳೆಗಳಿಗೆ ನೆರಳು ಒದಗಿಸಿ.')
    elif temps_max and min(temps_max[:3]) < 15:
        tips.append('ತಂಪು ಹವಾಮಾನ. ಜೀವಾಮೃತ ಹುದುಗುವಿಕೆಗೆ ಹೆಚ್ಚು ಸಮಯ ಬೇಕು.')

    if not tips:
        tips.append('ಈ ವಾರ ಹವಾಮಾನ ಸಾಮಾನ್ಯವಾಗಿದೆ. ನಿಯಮಿತ ಕೃಷಿ ಚಟುವಟಿಕೆ ಮುಂದುವರಿಸಿ.')

    return tips
