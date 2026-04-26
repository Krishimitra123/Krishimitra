"""
Module M2 — NLP & Intent Engine
Responsibility: Raw transcript → normalise → detect language → classify intent →
extract entities (crop, district, symptom, season) → route to M3 (RAG) or M4 (Diagnosis).

Pipeline: detect_language → normalise_query → classify_intent → extract_entities →
          build_enriched_query → return NLPResult
"""

import json
import re
from pathlib import Path
from collections import Counter
from models.schemas import NLPResult, Intent, UserContext

# ── Load vocabulary and lookup data once at startup ──────────────

VOCAB_PATH    = Path(__file__).parent.parent / 'corpus' / 'vocab_glossary.json'
DISTRICT_PATH = Path(__file__).parent.parent / 'corpus' / 'district_list.json'
CROP_PATH     = Path(__file__).parent.parent / 'corpus' / 'crop_list.json'

_vocab: list = []
_districts: list = []
_crops: list = []

# Pre-built lookup maps for O(1) access
_kn_to_en: dict = {}
_en_signal: dict = {}


def _load_data():
    """Load all static data files. Called once at import time."""
    global _vocab, _districts, _crops, _kn_to_en, _en_signal

    if VOCAB_PATH.exists():
        _vocab = json.loads(VOCAB_PATH.read_text(encoding='utf-8'))
    if DISTRICT_PATH.exists():
        _districts = json.loads(DISTRICT_PATH.read_text(encoding='utf-8'))
    if CROP_PATH.exists():
        _crops = json.loads(CROP_PATH.read_text(encoding='utf-8'))

    # Build lookup maps
    for entry in _vocab:
        for kw in entry.get('search_keywords', []):
            _kn_to_en[kw.lower()] = entry['english']
            _en_signal[kw.lower()] = entry.get('intent_signal', 'general')
        # Also map the Kannada script directly
        _kn_to_en[entry['kannada']] = entry['english']
        _en_signal[entry['kannada']] = entry.get('intent_signal', 'general')


# Load at import time
_load_data()


# ── Language Detection ───────────────────────────────────────────

def detect_language(text: str) -> str:
    """
    Detect if text is Kannada, English, or mixed.
    Returns: 'kn' | 'en' | 'mixed'
    """
    kannada_chars = sum(1 for c in text if '\u0C80' <= c <= '\u0CFF')
    total = len(text.replace(' ', ''))
    if total == 0:
        return 'en'
    ratio = kannada_chars / total
    if ratio > 0.6:
        return 'kn'
    if ratio < 0.1:
        return 'en'
    return 'mixed'


# ── Query Normalisation ─────────────────────────────────────────

def normalise_query(text: str) -> tuple:
    """
    Expands Kannada/transliterated terms to English equivalents for better RAG search.
    
    Returns:
        (normalised_text, matched_intent_signals)
    """
    text_lower = text.lower()
    matched_signals = []
    normalised = text

    for kn_term, en_term in _kn_to_en.items():
        if kn_term in text_lower or kn_term in text:
            normalised = normalised.replace(kn_term, en_term)
            signal = _en_signal.get(kn_term, 'general')
            matched_signals.append(signal)

    return normalised, matched_signals


# ── Intent Classification ────────────────────────────────────────

def classify_intent(text: str, signals: list) -> tuple:
    """
    Rule-based intent classification with confidence score.
    
    Priority:
    1. Image keywords → CROP_DIAGNOSIS
    2. Vocab signal matches → mapped intent
    3. Keyword-based fallback
    4. Out-of-domain check
    5. Default: GENERAL
    
    Returns: (Intent, confidence: float)
    """
    text_lower = text.lower()

    # Image diagnosis keywords
    if any(w in text_lower for w in ['photo', 'image', 'picture', 'ಫೋಟೋ', 'ಚಿತ್ರ']):
        return Intent.CROP_DIAGNOSIS, 0.95

    # Use matched vocab signals if unambiguous
    if signals:
        top_signal = Counter(signals).most_common(1)[0][0]
        if top_signal != 'general':
            intent_map = {
                'biofertiliser': Intent.BIOFERTILISER,
                'soil_query':    Intent.SOIL_QUERY,
                'pest_disease':  Intent.PEST_DISEASE,
                'crop_advice':   Intent.CROP_ADVICE,
                'certification': Intent.CERTIFICATION,
            }
            return intent_map.get(top_signal, Intent.GENERAL), 0.85

    # Keyword-based fallback
    SOIL_KW   = ['soil', 'fertility', 'pH', 'nitrogen', 'phosphorus', 'potassium',
                 'zinc', 'deficiency', 'ಮಣ್ಣು']
    PEST_KW   = ['pest', 'disease', 'fungus', 'blight', 'wilt', 'insect', 'bug',
                 'yellow', 'spots', 'ರೋಗ', 'ಕೀಟ']
    BIOFERT_KW = ['jeevamrutha', 'panchagavya', 'compost', 'vermicompost', 'neem',
                  'organic input']
    CERTIF_KW  = ['certif', 'NPOP', 'PGS', 'organic standard', 'ಪ್ರಮಾಣ']

    if any(k in text_lower for k in SOIL_KW):
        return Intent.SOIL_QUERY, 0.75
    if any(k in text_lower for k in PEST_KW):
        return Intent.PEST_DISEASE, 0.75
    if any(k in text_lower for k in BIOFERT_KW):
        return Intent.BIOFERTILISER, 0.75
    if any(k in text_lower for k in CERTIF_KW):
        return Intent.CERTIFICATION, 0.70

    # Out-of-domain check
    NON_AGRI = ['cricket', 'movie', 'film', 'politics', 'stock', 'price',
                'weather forecast']
    if any(k in text_lower for k in NON_AGRI):
        return Intent.OUT_OF_DOMAIN, 0.90

    return Intent.GENERAL, 0.50


# ── Entity Extraction ────────────────────────────────────────────

def extract_entities(text: str, user_ctx: UserContext) -> dict:
    """
    Extract crop, district, symptom keywords, season, preparation name from text.
    Pre-fills from user profile where not explicitly mentioned.
    """
    entities = {
        'crop_name': user_ctx.primary_crop if user_ctx else None,
        'district': user_ctx.district if user_ctx else None,
        'symptom_keywords': [],
        'season': user_ctx.season if user_ctx else None,
        'preparation_name': None,
    }
    text_lower = text.lower()

    # Crop detection
    for crop in _crops:
        if crop['name_en'].lower() in text_lower or crop.get('name_kn', '') in text:
            entities['crop_name'] = crop['name_en']
            break

    # Fallback: use profile crop if none detected
    if user_ctx and not entities['crop_name'] and user_ctx.primary_crop:
        entities['crop_name'] = user_ctx.primary_crop

    # District detection (overrides profile if mentioned explicitly)
    for d in _districts:
        if d.lower() in text_lower:
            entities['district'] = d
            break

    # Symptom keywords
    SYMPTOM_KW = [
        'yellow', 'brown', 'spots', 'wilt', 'dry', 'rot', 'curl', 'stunted',
        'ಹಳದಿ', 'ಕಂದು', 'ಒಣ', 'ಕೊಳೆ', 'ಬಾಡು',
    ]
    entities['symptom_keywords'] = [k for k in SYMPTOM_KW if k in text_lower or k in text]

    # Preparation name
    PREP_NAMES = [
        'jeevamrutha', 'beejamrutha', 'panchagavya', 'neem kashaya',
        'agniastra', 'brahmastra', 'dashaparni', 'ಜೀವಾಮೃತ', 'ಪಂಚಗವ್ಯ',
    ]
    for p in PREP_NAMES:
        if p in text_lower or p in text:
            entities['preparation_name'] = p
            break

    return entities


# ── Enriched Query Builder ───────────────────────────────────────

def build_enriched_query(normalised: str, entities: dict, intent: Intent) -> str:
    """
    Build the final query string for vector search, enriched with context.
    This is what gets embedded and searched in the vector DB.
    """
    parts = [normalised]

    if entities.get('crop_name'):
        parts.append(f"crop: {entities['crop_name']}")
    if entities.get('district'):
        parts.append(f"Karnataka district: {entities['district']}")
    if entities.get('symptom_keywords'):
        parts.append(' '.join(entities['symptom_keywords']))

    # Add intent-specific context enrichment
    if intent == Intent.SOIL_QUERY and entities.get('district'):
        parts.append('organic farming soil fertility Karnataka')
    if intent == Intent.BIOFERTILISER:
        parts.append('preparation method ingredients ratio')

    return ' '.join(parts)


# ── Main M2 Entry Point ─────────────────────────────────────────

async def process(transcript: str, user_ctx: UserContext, has_image: bool = False) -> NLPResult:
    """
    Main M2 entry point. Called from the query router.
    
    Args:
        transcript: Raw text from STT or typed input
        user_ctx: Farmer profile context
        has_image: Whether an image was provided with the query
    
    Returns:
        NLPResult with intent, entities, enriched query, and routing info
    """
    lang = detect_language(transcript)
    normalised, signals = normalise_query(transcript)
    intent, confidence = classify_intent(normalised, signals)

    # Override intent if image provided
    if has_image:
        intent = Intent.CROP_DIAGNOSIS
        confidence = 0.95

    entities = extract_entities(normalised, user_ctx)
    enriched = build_enriched_query(normalised, entities, intent)

    # Routing logic
    routing = []
    if intent == Intent.CROP_DIAGNOSIS:
        routing = ['diagnosis', 'rag']
    elif intent == Intent.OUT_OF_DOMAIN:
        routing = []
    else:
        routing = ['rag']

    return NLPResult(
        raw_transcript=transcript,
        normalised_query=normalised,
        detected_language=lang,
        intent=intent,
        confidence=confidence,
        entities=entities,
        has_image=has_image,
        enriched_query=enriched,
        routing=routing,
    )
