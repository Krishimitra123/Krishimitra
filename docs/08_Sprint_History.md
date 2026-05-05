# Sprint History & Changelog
## KrishiMitra — Development Timeline
**Document ID:** KM-SPRINT-001 | **Version:** 2.0 | **Date:** 2026-05-05  
**Reconstructed from:** Git commit history (30 commits, `dev` branch)

---

## Sprint 1: Foundation (Apr 20–26, 2026)

**Sprint Goal:** Voice-first query pipeline working end-to-end.

### Delivered
| Commit | Type | Description |
|--------|------|-------------|
| `f7a48bb` | fix | Voice M4A recording, empty STT handling, expo packages updated |
| `85fdb2a` | fix | Pixtral primary for diagnosis (50s hard cap), voice concurrent start guard |
| `2c19601` | fix | 45s query hard cap, STT/TTS timeouts reduced to 15s, TTS non-fatal |
| `0ecb644` | fix | M4A→WAV via ffmpeg subprocess (pydub broken in Py3.13) |
| `7291e1e` | fix | TTS 22kHz crisp audio, single-sound guard, conversation history |
| `a9b5f1c` | fix | Pixtral image_url format (string→{url:}), TTS speaker=amit 22050Hz |
| `eb8afeb` | fix | diagnose_image→diagnose endpoint rename, show real STT transcript |
| `fffe122` | feat | TTS full-text chunking, diagnosis Kannada summary + TTS, recording timer |
| `f799f67` | fix | M2 default intent SF_PREP, diagnosis prompt ALL fields Kannada |

**Blockers:** pydub incompatible with Python 3.13 (resolved: switched to subprocess ffmpeg)  
**Key Decision:** ADR-005 — Switched from Gemini Vision to Pixtral-12b for diagnosis  
**Retrospective:** Audio handling consumed 60% of sprint. Need better error logging.

---

## Sprint 2: RAG Integration & Data (Apr 27–May 3, 2026)

**Sprint Goal:** RAG pipeline live with verified corpus, knowledge graph data merged.

### Delivered
| Commit | Type | Description |
|--------|------|-------------|
| `ae0a2ef` | feat | About screen with Nivetti branding, docs/screenshots dir |
| `acb79c4` | feat | RAG pipeline live — M3→Supabase→M5 wired, threshold 0.30 for cross-lang |
| `ac49738` | feat | RAG engine + knowledge graph + benchmark 27/30 passing |
| `ab30d4b` | fix | District context preserved across follow-ups |
| `bbc11dc` | feat | Add Rikash and Shinan deliverables (structured KB data) |
| `20a05a8` | fix | Drop existing match_chunks before recreating |
| `7866b0d` | fix | Use uuid for document_chunks.id (was bigserial) |
| `b86bfa9` | merge | rikash-rag into dev |
| `f4857cd` | merge | All rikash-shinan data files resolved |
| `2dc805e` | fix | Restore all Rikash/Shinan data files — 11 structured JSONs |
| `7cda4ab` | feat | Ingest 88 structured KB chunks into RAG |
| `5bc856f` | feat | AI personality upgrade — wise elder farmer persona, 7K chunk import |

**Key Decision:** RAG threshold tuned from 0.70→0.60 for better Kannada cross-lingual retrieval  
**Merge Conflicts:** 3 conflicts resolved during rikash-rag merge (m3_rag.py, data files)  
**Retrospective:** Data quality is critical. Shinan's structured JSONs dramatically improved answer quality.

---

## Sprint 3: Polish, APIs & Documentation (May 4–7, 2026)

**Sprint Goal:** External API integration, home screen widgets, corporate documentation.

### Delivered
| Commit | Type | Description |
|--------|------|-------------|
| `d08d2d9` | feat | New chat button, stop playback, multi-crop onboarding |
| `319a020` | feat | Nivetti Systems logo in header |
| `4541a87` | style | Replace emojis with Nivetti logo |
| `febff38` | fix | SQLITE_FULL by excluding audio from persistence, agriculture guardrails |
| `29bfa7a` | perf | Remove gemini fallback, use direct pixtral-12b |
| `5c7688f` | fix | Startup AsyncStorage migration to strip audio_base64 |
| `eeef9af` | fix | Compress images server-side, reduce mobile capture quality to 0.4 |
| `dedb26c` | fix | Increase pixtral max_tokens to 1000 (Kannada JSON truncation) |
| `c33678c` | fix | Proper WAV chunk parser for TTS concatenation |
| — | feat | Weather API (Open-Meteo), Soil API (SoilGrids), Market API (curated) |
| — | feat | Home screen widgets (weather, market, soil) |
| — | docs | Full SDLC documentation suite (12 documents) |

**Critical Bug Fixed:** SQLITE_FULL — large audio base64 blobs were being persisted to AsyncStorage. Fixed with `partialize` in Zustand and startup migration script.

---

## Version History

| Version | Date | Highlights |
|---------|------|-----------|
| v0.1 | Apr 20 | Basic FastAPI + voice recording |
| v0.5 | Apr 26 | Full query pipeline (STT→NLP→RAG→LLM→TTS) |
| v1.0 | May 3 | RAG live, 88 KB chunks, diagnosis working, Nivetti branding |
| v2.0 | May 5 | Weather/Soil/Market APIs, home widgets, full documentation |
