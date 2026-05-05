# Testing Strategy & QA Report
## KrishiMitra — Test Plan and Results
**Document ID:** KM-TEST-001 | **Version:** 2.0 | **Date:** 2026-05-05

---

## 1. Test Strategy

| Level | Scope | Tools | Status |
|-------|-------|-------|--------|
| Unit Tests | Individual functions (embed, classify, filter) | pytest | Planned |
| Integration Tests | End-to-end pipeline (STT→RAG→LLM→TTS) | curl + manual | Done |
| API Tests | All endpoints (query, diagnose, weather, soil, market) | curl | Done |
| RAG Benchmark | 30 agriculture queries → retrieval quality | benchmark_rag.py | 27/30 pass |
| Mobile UI Tests | Screen rendering, navigation, widget loading | Manual | Done |

## 2. Test Case Matrix

### Core Pipeline Tests

| TC-ID | Scenario | Input | Expected | Status |
|-------|----------|-------|----------|--------|
| TC-001 | Voice query in Kannada | Audio "ಜೀವಾಮೃತ ಹೇಗೆ" | Transcript + answer + audio | ✅ |
| TC-002 | Text query in Kannada | "ಮಣ್ಣಿನ pH ಹೆಚ್ಚಿಸುವುದು" | RAG answer + sources | ✅ |
| TC-003 | Chemical filter block | Ask about Urea | Blocked, redirect KVK | ✅ |
| TC-004 | Disease diagnosis | Leaf photo | Disease name + treatments | ✅ |
| TC-005 | Low confidence query | "ರಾಕೆಟ್ ಸೈನ್ಸ್" | KVK redirect | ✅ |
| TC-006 | Multi-turn follow-up | "ಇನ್ನಷ್ಟು ಹೇಳಿ" after query | Context-aware response | ✅ |
| TC-007 | Empty audio | <100 chars base64 | Error: "too short" | ✅ |
| TC-008 | 45s timeout | Slow network | Timeout error gracefully | ✅ |

### Weather API Tests

| TC-ID | Scenario | Input | Expected | Status |
|-------|----------|-------|----------|--------|
| TC-020 | Weather by district | `?district=Mysuru` | Current temp + 7-day forecast | ✅ |
| TC-021 | Weather by coordinates | `?lat=12.3&lon=76.6` | Weather data | ✅ |
| TC-022 | Invalid district | `?district=Mumbai` | 404 error | ✅ |
| TC-023 | Agriculture weather | `/agriculture?district=Tumakuru` | Soil temp + moisture + tips | ✅ |
| TC-024 | Cache hit (2nd call) | Same request within 1hr | Cached response (faster) | ✅ |

### Soil API Tests

| TC-ID | Scenario | Input | Expected | Status |
|-------|----------|-------|----------|--------|
| TC-030 | Soil by district | `?district=Kalaburagi` | SoilGrids + zone data | ✅ |
| TC-031 | Zone data | `/zone/1` | North-East Transition zone info | ✅ |
| TC-032 | All zones | `/zones` | 10 zones array | ✅ |
| TC-033 | Organic recommendations | District with N deficiency | Kannada recommendation for Jeevamrutha | ✅ |

### Market API Tests

| TC-ID | Scenario | Input | Expected | Status |
|-------|----------|-------|----------|--------|
| TC-040 | All prices | No filters | All curated prices | ✅ |
| TC-041 | Filter by district | `?district=Tumakuru` | Tumakuru prices only | ✅ |
| TC-042 | Filter by commodity | `?commodity=Ragi` | Ragi prices only | ✅ |
| TC-043 | Commodities list | `/commodities` | 15+ commodities | ✅ |

## 3. RAG Benchmark Results

**Script:** `backend/scripts/benchmark_rag.py`  
**Result:** 27/30 queries passed (90% accuracy)

| Category | Queries | Passed | Notes |
|----------|---------|--------|-------|
| Jeevamrutha preparation | 5 | 5/5 | Strong retrieval |
| Mulching guidance | 4 | 4/4 | Good coverage |
| Soil management | 5 | 4/5 | 1 miss: rare zone-specific query |
| Disease-related | 4 | 3/4 | 1 miss: uncommon disease name |
| Cow-based inputs | 4 | 4/4 | Excellent |
| General farming | 8 | 7/8 | 1 miss: very broad query |

## 4. Performance Benchmarks

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Full voice query (STT+RAG+LLM+TTS) | <15s | 8-12s | ✅ |
| Text query (RAG+LLM) | <10s | 3-6s | ✅ |
| Disease diagnosis | <30s | 10-20s | ✅ |
| Weather API response | <3s | 0.5-2s | ✅ |
| Soil API response | <5s | 2-4s | ✅ |
| Market API response | <1s | <0.1s (cached) | ✅ |
| App startup | <3s | 1.5-2s | ✅ |

## 5. Known Issues

| ID | Issue | Severity | Workaround |
|----|-------|----------|-----------|
| BUG-001 | Gemini API quota exhausted | Medium | Using Mistral/Pixtral exclusively |
| BUG-002 | SoilGrids occasionally returns 503 | Low | Local zone data served as fallback |
| BUG-003 | Data.gov.in API key pending | Low | Curated JSON data serves immediately |
| BUG-004 | expo-av deprecation warning | Low | Suppressed via LogBox.ignoreLogs |
