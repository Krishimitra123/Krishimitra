"""
KrishiMitra — Pydantic Request/Response Models
All API data contracts live here. No module imports these internals except through this file.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from enum import Enum


# ── Intent Classification Enum ───────────────────────────────────

class Intent(str, Enum):
    CROP_ADVICE    = 'crop_advice'       # General cultivation query
    SOIL_QUERY     = 'soil_query'        # Soil fertility / deficiency query
    PEST_DISEASE   = 'pest_disease'      # Pest or disease management
    BIOFERTILISER  = 'biofertiliser'     # Preparation of organic inputs
    CROP_DIAGNOSIS = 'crop_diagnosis'    # Image-based diagnosis request
    CERTIFICATION  = 'certification'     # Organic certification query
    GENERAL        = 'general'           # Doesn't fit above categories
    OUT_OF_DOMAIN  = 'out_of_domain'     # Non-farming query


# ── User Context (Farmer Profile) ────────────────────────────────

class UserContext(BaseModel):
    farmer_name:    Optional[str] = None
    district:       Optional[str] = None    # Karnataka district name
    primary_crop:   Optional[str] = None    # Main crop farmer grows
    agro_zone:      Optional[int] = None    # 1-10 Karnataka zone
    season:         Optional[str] = None    # kharif | rabi | zaid | current


# ── M2: NLP Result ───────────────────────────────────────────────

class NLPResult(BaseModel):
    raw_transcript:       str                                # Original STT output
    normalised_query:     str                                # After vocab expansion
    detected_language:    Literal['kn', 'en', 'mixed']
    intent:               Intent
    confidence:           float = Field(ge=0.0, le=1.0)      # Intent confidence
    entities:             dict = Field(default_factory=dict)
    # entities structure:
    # { crop_name: str|None, district: str|None, symptom_keywords: list[str],
    #   season: str|None, preparation_name: str|None }
    has_image:            bool = False
    enriched_query:       str  = ''     # Final query for vector search
    routing:              List[str] = []  # ['rag'] | ['diagnosis'] | ['rag','diagnosis']


# ── M4: Diagnosis Models ─────────────────────────────────────────

class DiagnosisRequest(BaseModel):
    image_base64:   str                       # Base64-encoded image (JPEG/PNG)
    image_mime:     str = 'image/jpeg'        # 'image/jpeg' | 'image/png'
    optional_text:  Optional[str] = None      # Farmer's spoken description
    user_context:   UserContext = UserContext()


class DiagnosisFinding(BaseModel):
    plant_health_status:   str                 # Healthy | Diseased | Unclear
    disease_name:          str
    disease_name_kn:       str                 # Kannada name
    confidence_pct:        int                 # 0-100
    visual_symptoms:       List[str]           # What the model saw
    probable_cause:        str                 # Fungal / Bacterial / Nutrient deficiency / Pest
    organic_treatments:    List[str]           # Step-by-step organic treatments
    prevention_measures:   List[str]
    sources:               List[str]           # RAG citations for treatments
    is_reliable:           bool                # False if confidence < 50%
    needs_retake:          bool                # True if image is unclear


class DiagnosisResponse(BaseModel):
    finding:        Optional[DiagnosisFinding] = None
    answer_text_kn: str                        # Full response in Kannada
    audio_base64:   Optional[str] = None       # TTS audio
    error:          Optional[str] = None


# ── M5/M6: Query Models ──────────────────────────────────────────

class QueryRequest(BaseModel):
    audio_base64:   Optional[str]  = None      # Voice query
    text_query:     Optional[str]  = None      # Text query fallback
    image_base64:   Optional[str]  = None      # For diagnosis
    image_mime:     str = 'image/jpeg'
    user_context:   UserContext = UserContext()


class QueryResponse(BaseModel):
    transcript:      Optional[str]  = None     # What STT heard
    answer_text_kn:  str                       # Final answer in Kannada
    audio_base64:    Optional[str]  = None     # TTS audio (MP3 base64)
    sources:         List[str] = []            # Citation strings
    intent:          Optional[str]  = None
    diagnosis:       Optional[dict] = None     # If diagnosis was performed
    is_kvk_redirect: bool = False              # True if no RAG match
    error:           Optional[str]  = None


# ── Admin: Ingestion Models ──────────────────────────────────────

class IngestRequest(BaseModel):
    pdf_url:        str                        # URL or local path to PDF
    category:       str                        # 'biofertiliser'|'soil_fertility'|...
    language:       str = 'en'                 # 'en' | 'kn'
    source_doc:     str                        # Human-readable source name
    crop_tag:       Optional[str] = None
    zone_tag:       Optional[int] = None


class IngestResponse(BaseModel):
    chunks_created:    int
    embeddings_stored: int
    status:            str                     # 'success' | 'error'
    error:             Optional[str] = None
