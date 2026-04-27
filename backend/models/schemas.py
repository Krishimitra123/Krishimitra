from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum

class ConversationMessage(BaseModel):
    role: str   # 'user' or 'assistant'
    content: str

class Intent(str, Enum):
    SF_PREP = "SF_PREP"
    SF_APPLY = "SF_APPLY"
    SF_MULCH = "SF_MULCH"
    SF_SOIL = "SF_SOIL"
    SF_COW = "SF_COW"
    DIAGNOSE = "DIAGNOSE"
    COMING_SOON = "COMING_SOON"
    OUT_OF_DOMAIN = "OUT_OF_DOMAIN"
    PEST_DISEASE = "PEST_DISEASE"

class UserContext(BaseModel):
    farmer_name: Optional[str] = None
    district: Optional[str] = None
    primary_crop: Optional[str] = None
    agro_zone: Optional[int] = None
    season: Optional[str] = None

class DiagnosisRequest(BaseModel):
    image_base64: str
    image_mime: str = "image/jpeg"
    user_context: Optional[UserContext] = None
    optional_text: Optional[str] = None

class DiagnosisFinding(BaseModel):
    plant_health_status: str
    disease_name: str
    disease_name_kn: str
    confidence_pct: float
    visual_symptoms: List[str]
    probable_cause: str
    organic_treatments: List[str]
    prevention_measures: List[str]
    needs_retake: bool
    sources: List[str] = Field(default_factory=list)
    is_reliable: bool = False
    summary_kn: Optional[str] = None     # Kannada prose summary of the diagnosis
    audio_base64: Optional[str] = None   # TTS audio of the Kannada summary


class QueryRequest(BaseModel):
    audio_base64: Optional[str] = None
    audio_mime: str = "audio/mp4"
    text_query: Optional[str] = None
    image_base64: Optional[str] = None
    image_mime: str = "image/jpeg"
    user_context: Optional[UserContext] = None
    conversation_history: Optional[List[ConversationMessage]] = None  # Last N exchanges for context

class QueryResponse(BaseModel):
    transcript: Optional[str] = None
    answer_text_kn: str
    audio_base64: Optional[str] = None
    sources: List[str] = Field(default_factory=list)
    intent: Optional[str] = None
    is_kvk_redirect: bool = False
    confidence_score: Optional[int] = None
    error: Optional[str] = None

# Internal schemas used by M2 NLP
class NLPResult(BaseModel):
    raw_transcript: str
    normalised_query: str
    detected_language: str
    intent: Intent
    confidence: float
    entities: dict
    has_image: bool
    enriched_query: str
    routing: List[str] = Field(default_factory=list)
