from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum

class Intent(str, Enum):
    SF_PREP = "SF_PREP"
    SF_APPLY = "SF_APPLY"
    SF_MULCH = "SF_MULCH"
    SF_SOIL = "SF_SOIL"
    SF_COW = "SF_COW"
    DIAGNOSE = "DIAGNOSE"
    COMING_SOON = "COMING_SOON"
    OUT_OF_DOMAIN = "OUT_OF_DOMAIN"

class UserContext(BaseModel):
    farmer_name: Optional[str] = None
    district: Optional[str] = None
    primary_crop: Optional[str] = None
    agro_zone: Optional[int] = None
    season: Optional[str] = None

class QueryRequest(BaseModel):
    audio_base64: Optional[str] = None
    text_query: Optional[str] = None
    image_base64: Optional[str] = None
    image_mime: str = "image/jpeg"
    user_context: UserContext

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
