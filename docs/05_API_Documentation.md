# API Documentation
## KrishiMitra — REST API Reference
**Document ID:** KM-API-001 | **Version:** 2.0 | **Date:** 2026-05-05  
**Base URL:** `http://localhost:8000` (dev) | `https://your-deploy.railway.app` (prod)

---

## 1. Health Check

### `GET /health`
```bash
curl http://localhost:8000/health
```
**Response:**
```json
{"status":"ok","version":"2.0.0","app":"KrishiMitra by Nivetti Systems","endpoints":{"query":"/api/query","diagnose":"/api/diagnose","weather":"/api/weather","soil":"/api/soil","market":"/api/market"}}
```

---

## 2. Core Endpoints

### `POST /api/query` — Voice/Text Query
Send a farming question (voice or text) and receive AI-generated, RAG-grounded response in Kannada.

```bash
# Text query
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"text_query": "ಜೀವಾಮೃತ ಹೇಗೆ ತಯಾರಿಸುವುದು?"}'

# Voice query
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"audio_base64": "<base64_audio>", "audio_mime": "audio/mp4"}'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text_query` | string | One of text/audio | Kannada text query |
| `audio_base64` | string | One of text/audio | Base64-encoded audio |
| `audio_mime` | string | With audio | MIME type (audio/mp4, audio/wav) |
| `conversation_history` | array | No | Last 6 turns for context |
| `user_context` | object | Auto-injected | Farmer profile (name, district, crop) |

**Response (200):**
```json
{
  "transcript": "ಜೀವಾಮೃತ ಹೇಗೆ ತಯಾರಿಸುವುದು",
  "answer_text_kn": "ಜೀವಾಮೃತ ತಯಾರಿಸಲು...",
  "audio_base64": "<base64_wav>",
  "sources": ["ICAR_Organic_Guide_2023", "Palekar_ZBNF_Ch3"],
  "intent": "SF_PREP",
  "is_kvk_redirect": false,
  "error": null
}
```

### `POST /api/diagnose` — Crop Disease Diagnosis
```bash
curl -X POST http://localhost:8000/api/diagnose \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "<base64_jpeg>", "image_mime": "image/jpeg"}'
```

**Response (200):**
```json
{
  "plant_health_status": "DISEASED",
  "disease_name": "Leaf Blight",
  "disease_name_kn": "ಎಲೆ ಸುಟ್ಟ ರೋಗ",
  "confidence_pct": 85,
  "visual_symptoms": ["ಎಲೆ ಹಳದಿ ಬಣ್ಣ"],
  "organic_treatments": ["ನೀಮ್ ಎಣ್ಣೆ 3% ಸಿಂಪರಣೆ"],
  "prevention_measures": ["ಬೆಳೆ ಬದಲಾವಣೆ"],
  "needs_retake": false,
  "sources": ["NIPHM_Disease_Guide"],
  "is_reliable": true
}
```

---

## 3. Weather Endpoints

### `GET /api/weather` — Current Weather + 7-Day Forecast
```bash
# By district
curl "http://localhost:8000/api/weather?district=Mysuru"

# By coordinates
curl "http://localhost:8000/api/weather?lat=12.30&lon=76.66"
```

### `GET /api/weather/agriculture` — Agriculture Weather Data
```bash
curl "http://localhost:8000/api/weather/agriculture?district=Tumakuru"
```
Returns soil temperature, moisture, evapotranspiration, and farming tips in Kannada.

### `GET /api/weather/districts` — List Available Districts
```bash
curl http://localhost:8000/api/weather/districts
```

---

## 4. Soil Endpoints

### `GET /api/soil` — Comprehensive Soil Data
```bash
curl "http://localhost:8000/api/soil?district=Kalaburagi"
```
Returns SoilGrids data (pH, nitrogen, organic carbon, clay/sand/silt) + Karnataka zone data + organic recommendations.

### `GET /api/soil/zone/{zone_id}` — Zone Data
```bash
curl http://localhost:8000/api/soil/zone/1
```

### `GET /api/soil/zones` — All Karnataka Zones
```bash
curl http://localhost:8000/api/soil/zones
```

---

## 5. Market Endpoints

### `GET /api/market/prices` — Mandi Prices
```bash
# All Karnataka
curl http://localhost:8000/api/market/prices

# Filtered
curl "http://localhost:8000/api/market/prices?district=Tumakuru&commodity=Ragi"
```

### `GET /api/market/commodities` — Available Commodities
```bash
curl http://localhost:8000/api/market/commodities
```

### `GET /api/market/districts` — Market Districts
```bash
curl http://localhost:8000/api/market/districts
```

---

## 6. Admin Endpoints

### `POST /api/admin/ingest` — Ingest Knowledge Document
```bash
curl -X POST http://localhost:8000/api/admin/ingest \
  -H "Content-Type: application/json" \
  -d '{"source_url": "path/to/document.pdf", "category": "SF_PREP"}'
```

---

## 7. Error Codes

| HTTP Code | Meaning | Action |
|-----------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad request (missing params) | Check request body |
| 404 | District/zone not found | Use valid Karnataka district |
| 500 | Internal server error | Check backend logs |
| 502 | External API error | External service down, wait |
| 504 | Timeout | Retry after 5 seconds |
