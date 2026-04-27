import json
import re
from pathlib import Path
from models.schemas import NLPResult, Intent, UserContext

VOCAB_PATH    = Path(__file__).parent.parent / 'corpus' / 'vocab_glossary.json'
DISTRICT_PATH = Path(__file__).parent.parent / 'corpus' / 'district_list.json'
CROP_PATH     = Path(__file__).parent.parent / 'corpus' / 'crop_list.json'
ZONE_PATH     = Path(__file__).parent.parent / 'corpus' / 'karnataka_zones.json'

_vocab: list = []
_districts: list = []
_crops: list = []
_zones: dict = {}

_kn_to_en: dict = {}
_en_signal: dict = {}

def _load_data():
    global _vocab, _districts, _crops, _zones, _kn_to_en, _en_signal

    if VOCAB_PATH.exists():
        _vocab = json.loads(VOCAB_PATH.read_text(encoding='utf-8'))
    if DISTRICT_PATH.exists():
        _districts = json.loads(DISTRICT_PATH.read_text(encoding='utf-8'))
    if CROP_PATH.exists():
        _crops = json.loads(CROP_PATH.read_text(encoding='utf-8'))
    if ZONE_PATH.exists():
        _zones = json.loads(ZONE_PATH.read_text(encoding='utf-8'))

    for entry in _vocab:
        for kw in entry.get('search_keywords', []):
            _kn_to_en[kw.lower()] = entry['english']
            _en_signal[kw.lower()] = entry.get('intent_signal', 'general')
        _kn_to_en[entry['kannada']] = entry['english']
        _en_signal[entry['kannada']] = entry.get('intent_signal', 'general')

_load_data()

def detect_language(text: str) -> str:
    """
    detect_language(text: str) -> str checks the ratio of Kannada Unicode 
    characters (range 0x0C80 to 0x0CFF) to total non-space characters. 
    Above 60% ratio returns "kn", below 10% returns "en", otherwise returns "mixed".
    """
    text_no_space = text.replace(" ", "").replace("\n", "").strip()
    if not text_no_space:
        return "en"
        
    kn_count = sum(1 for char in text_no_space if '\u0c80' <= char <= '\u0cff')
    ratio = kn_count / len(text_no_space)
    
    if ratio > 0.60:
        return "kn"
    elif ratio < 0.10:
        return "en"
    else:
        return "mixed"

def normalise_query(text: str) -> tuple[str, list[str]]:
    """
    normalise_query(text: str) -> tuple[str, list[str]] iterates through the loaded 
    vocabulary glossary and replaces Kannada terms with their English equivalents, 
    collecting matched intent signals as it goes.
    """
    words = text.split()
    normalised_words = []
    signals = []
    
    for word in words:
        w_lower = word.lower()
        # Very basic replacement, can be improved with regex boundary
        matched = False
        for kn_key, en_val in _kn_to_en.items():
            if kn_key in w_lower:
                normalised_words.append(en_val)
                signals.append(_en_signal.get(kn_key, 'general'))
                matched = True
                break
        if not matched:
            normalised_words.append(word)
            
    return " ".join(normalised_words), signals

def classify_intent(text: str, signals: list[str], original_text: str = '') -> tuple[Intent, float]:
    """
    Phase 1 whitelist gate.
    Matches on BOTH the original (Kannada) text AND the normalised (English) text.
    """
    text_lower = text.lower()
    orig_lower = original_text.lower() if original_text else text_lower

    # Combine both for matching
    combined = text_lower + ' ' + orig_lower

    # Signal-based shortcuts from vocab glossary
    if 'biofertiliser' in signals:
        return Intent.SF_PREP, 0.90
    if 'soil_query' in signals:
        return Intent.SF_SOIL, 0.90

    # Image / Diagnose triggers
    DIAGNOSE_KW = ['photo', 'image', 'picture', 'diagnose', 'what is this',
                   'ಫೋಟೋ', 'ಚಿತ್ರ', 'ರೋಗ ಪತ್ತೆ', 'ರೋಗ ಗುರುತಿಸು']
    if any(w in combined for w in DIAGNOSE_KW):
        return Intent.DIAGNOSE, 0.95

    # Out of domain
    OOD_KW = ['cricket', 'movie', 'stock price', 'cinema', 'ipl', 'football',
               'ಕ್ರಿಕೆಟ್', 'ಸಿನಿಮಾ', 'ಸ್ಟಾಕ್']
    if any(w in combined for w in OOD_KW):
        return Intent.OUT_OF_DOMAIN, 0.99

    # ── Phase 1 Whitelist ─────────────────────────────────────────
    # SF_PREP: Preparation of organic inputs
    PREP_KW = [
        # English
        'jeevamrutha', 'jivamrita', 'gau krupa', 'kunapa jala', 'vermicompost',
        'beejamrutha', 'panchagavya', 'how to make', 'prepare', 'recipe', 'ferment',
        'biofertiliser', 'bio fertiliser', 'liquid manure',
        # Kannada (what farmers actually say)
        'ಜೀವಾಮೃತ', 'ಜೀವ ಅಮೃತ', 'ಬೀಜಾಮೃತ', 'ಗೌ ಕೃಪ', 'ಪಂಚಗವ್ಯ',
        'ತಯಾರಿ', 'ತಯಾರಿಸು', 'ತಯಾರಿಸುವ', 'ತಯಾರಿಸುವುದು', 'ಹೇಗೆ ಮಾಡು',
        'ಗೊಬ್ಬರ ತಯಾರಿ', 'ಎರೆಹುಳು ಗೊಬ್ಬರ', 'ಕೊಟ್ಟಿಗೆ ಗೊಬ್ಬರ',
        'ವರ್ಮಿಕಂಪೋಸ್ಟ್', 'ಕಂಪೋಸ್ಟ್',
    ]

    # SF_APPLY: Application timing/dosage
    APPLY_KW = [
        'apply', 'when to', 'how much', 'spray', 'dosage', 'application', 'drench',
        'ಹಾಕು', 'ಹಾಕುವ', 'ಹಾಕುವುದು', 'ಸಿಂಪಡಿಸು', 'ಎಷ್ಟು ಹಾಕ', 'ಯಾವಾಗ ಹಾಕ',
        'ಪ್ರಮಾಣ', 'ಡೋಸ್', 'ಸಿಂಪರಣೆ',
    ]

    # SF_MULCH: Mulching plants
    MULCH_KW = [
        'mulch', 'mulching', 'nugge', 'agase', 'gliricidia', 'sunhemp', 'dhaincha', 'lop',
        'ಮಲ್ಚಿಂಗ್', 'ನುಗ್ಗೆ', 'ಅಗಸೆ', 'ಹೊದಿಕೆ', 'ಹಸಿರು ಗೊಬ್ಬರ',
    ]

    # SF_SOIL: Soil fertility and health
    SOIL_KW = [
        'soil', 'fertility', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'zinc',
        'deficiency', 'yellowing', 'organic matter', 'soil health', 'microbe',
        'ಮಣ್ಣು', 'ಫಲವತ್ತತೆ', 'ಮಣ್ಣಿನ ಆರೋಗ್ಯ', 'ಪೋಷಕಾಂಶ', 'ಸತುವು ಕೊರತೆ',
        'ಹಳದಿ ರೋಗ', 'ಎಲೆ ಹಳದಿ', 'ಬಾಡು', 'ಒಣಗು',
    ]

    # SF_COW: Cow-related queries
    COW_KW = [
        'cow', 'desi cow', 'urine', 'dung', 'cattle',
        'ಹಸು', 'ದೇಸಿ ಹಸು', 'ಗೋಮೂತ್ರ', 'ಸಗಣಿ', 'ಗಂಜಲ',
    ]

    if any(w in combined for w in PREP_KW):
        return Intent.SF_PREP, 0.85
    elif any(w in combined for w in MULCH_KW):
        return Intent.SF_MULCH, 0.85
    elif any(w in combined for w in SOIL_KW):
        return Intent.SF_SOIL, 0.85
    elif any(w in combined for w in APPLY_KW):
        return Intent.SF_APPLY, 0.85
    elif any(w in combined for w in COW_KW):
        return Intent.SF_COW, 0.85

    return Intent.COMING_SOON, 0.99

def extract_entities(text: str, user_ctx: UserContext) -> dict:
    text_lower = text.lower()
    entities = {
        'crop_name': user_ctx.primary_crop if user_ctx else None,
        'district': user_ctx.district if user_ctx else None,
        'symptom_keywords': [],
        'preparation_name': None,
        'zone_enrichment': None
    }
    
    # Crops
    for crop in _crops:
        if crop.get('name_en', '').lower() in text_lower or crop.get('name_kn', '') in text_lower:
            entities['crop_name'] = crop.get('name_en')
            break

    # Districts
    for dist in _districts:
        if isinstance(dist, str) and dist.lower() in text_lower:
            entities['district'] = dist
            break
        elif isinstance(dist, dict):
            if dist.get('english', '').lower() in text_lower or dist.get('kannada', '') in text_lower:
                entities['district'] = dist.get('english')
                break
            
    # Symptoms
    SYMPTOM_KW = ['yellowing', 'wilt', 'stunted', 'spots', 'curling', 'ಹಳದಿ', 'ಒಣಗಿದೆ']
    for sym in SYMPTOM_KW:
        if sym in text_lower:
            entities['symptom_keywords'].append(sym)
            
    # Preparation
    PREPS = ['jeevamrutha', 'gau krupa amrutha', 'kunapa jala', 'vermicompost']
    for p in PREPS:
        if p in text_lower:
            entities['preparation_name'] = p
            break
            
    # Zone enrichment for Soil intents
    if entities['district'] and _zones:
        # Find the zone for this district
        for zone_id, zone_data in _zones.items():
            if entities['district'].lower() in [d.lower() for d in zone_data.get('districts', [])]:
                entities['zone_enrichment'] = {
                    'zone_id': zone_id,
                    'deficiencies': zone_data.get('major_deficiencies', [])
                }
                break
                
    return entities

def process(transcript: str, user_ctx: UserContext = None, has_image: bool = False) -> NLPResult:
    lang = detect_language(transcript)
    normalised, signals = normalise_query(transcript)
    # Pass BOTH normalised text AND original transcript so Kannada terms are matched directly
    intent, confidence = classify_intent(normalised, signals, original_text=transcript)
    
    if has_image and intent != Intent.OUT_OF_DOMAIN:
        intent = Intent.DIAGNOSE
        confidence = 0.95
        
    entities = extract_entities(normalised, user_ctx)
    
    enriched = normalised
    if entities['zone_enrichment']:
        enriched += f" [ZONE_CONTEXT: {entities['zone_enrichment']}]"
        
    routing = []
    if intent in [Intent.SF_PREP, Intent.SF_APPLY, Intent.SF_MULCH, Intent.SF_SOIL, Intent.SF_COW]:
        routing = ['skb', 'kg', 'rag']
    elif intent == Intent.DIAGNOSE:
        routing = ['diagnose']
        
    return NLPResult(
        raw_transcript=transcript,
        normalised_query=normalised,
        detected_language=lang,
        intent=intent,
        confidence=confidence,
        entities=entities,
        has_image=has_image,
        enriched_query=enriched,
        routing=routing
    )
