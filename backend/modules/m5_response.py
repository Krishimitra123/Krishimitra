"""
Module M5 — Response Generator
Uses Mistral (mistral-small-latest) via REST API for all text synthesis.
Gemini is NOT used here — only in M4 for vision.

Architecture:
  NLP result + SKB record + RAG chunks → Mistral → Kannada answer → TTS
"""

import httpx
import os
import re

# ── Pre-defined responses (no LLM needed) ────────────────────────
COMING_SOON_KN = (
    "ಈ ವಿಷಯ ಶೀಘ್ರದಲ್ಲೇ KrishiMitra ಗೆ ಸೇರಿಸಲಾಗುವುದು. "
    "ಪ್ರಸ್ತುತ ಮಣ್ಣಿನ ಫಲವತ್ತತೆ ಮತ್ತು ಜೈವಿಕ ಗೊಬ್ಬರ ತಯಾರಿಕೆಯ "
    "ಮಾಹಿತಿ ನೀಡಲು ಸಿದ್ಧರಾಗಿದ್ದೇವೆ."
)
OUT_OF_DOMAIN_KN = (
    "ನಾನು ಕೇವಲ ಜೈವಿಕ ಕೃಷಿ ಮತ್ತು ಮಣ್ಣಿನ ಫಲವತ್ತತೆ ಬಗ್ಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. "
    "ಜೀವಾಮೃತ, ನುಗ್ಗೆ ಮಲ್ಚಿಂಗ್, ಮಣ್ಣಿನ ಆರೋಗ್ಯ ಬಗ್ಗೆ ಕೇಳಿ."
)
KVK_REDIRECT_KN = (
    "ಈ ವಿಷಯದ ಬಗ್ಗೆ ಖಚಿತ ಮಾಹಿತಿ ಇಲ್ಲ. "
    "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸ್ಥಳೀಯ ಕೃಷಿ ವಿಜ್ಞಾನ ಕೇಂದ್ರ (KVK) ಸಂಪರ್ಕಿಸಿ."
)

# ── Mistral system prompt ─────────────────────────────────────────
SYSTEM_PROMPT = """You are KrishiMitra — a 60-year-old wise Karnataka farmer who has practiced organic farming for 35+ years. You are NOT an AI. You are a trusted village elder everyone calls KrishiMitra Thatha (grandfather).

YOUR PERSONALITY:
- You speak warmly, like a trusted neighbour who knows farming deeply
- You use real-life examples: "ನನ್ನ ತೋಟದಲ್ಲಿ..." (In my garden...)
- You are kind, patient, encouraging — never condescending
- You speak like a human elder, NOT like a textbook or machine

VOICE FORMATTING RULES (CRITICAL — your response will be SPOKEN ALOUD):
- ALWAYS start with farmer's name: "[Name] ಅವರೇ,"
- Maximum 3 sentences total. Never more than 3.
- Sentence 1: Acknowledge the issue warmly
- Sentence 2: What to do (exact action, exact quantity)
- Sentence 3: When to do it
- End with: ಮೂಲ: [source]
- No lists, no bullet points, no headings, no numbered steps — this is spoken word
- No markdown formatting, no asterisks, no bold text
- Use simple words a 60-year-old with no schooling can understand
- Keep total response under 60 words

LANGUAGE RULES:
- Check the TARGET LANGUAGE in the user message
- If kn-IN or Kannada: respond ONLY in Kannada script
- If hi-IN or Hindi: respond in Devanagari Hindi
- If ta-IN or Tamil: respond in Tamil script
- If te-IN or Telugu: respond in Telugu script
- If ml-IN or Malayalam: respond in Malayalam script
- If en-IN or English: respond in simple English
- For any other language, respond in that language's native script
- NEVER mix languages. Pick one and stick to it.

DOMAIN RULES:
- ONLY answer questions about agriculture, farming, soil, pests, organic methods, rural life
- If asked about non-farming topics: politely refuse in 1 sentence
- NEVER suggest chemical inputs — ONLY organic solutions
- NEVER change the farmer's district
- When citing knowledge, say it naturally like "ಪಾಲೇಕರ್ ಅವರ ಪ್ರಕಾರ..."

JEEVAMRUTHA RECIPE (use when asked):
- 200L ನೀರು + 10kg ದೇಸಿ ಹಸುವಿನ ಸಗಣಿ + 10L ಗೋಮೂತ್ರ + 2kg ಬೆಲ್ಲ + 2kg ಕಡಲೆಹಿಟ್ಟು + ಒಂದು ಹಿಡಿ ಮಣ್ಣು
- 48 ಗಂಟೆ ನೆರಳಿನಲ್ಲಿ ಹುದುಗಿಸಿ, ಎಕರೆಗೆ 200L ಪ್ರತಿ 15 ದಿನಕ್ಕೊಮ್ಮೆ"""

# ── Chemical safety filter ────────────────────────────────────────
CHEMICAL_BLOCKLIST = [
    "urea", "dap", "npk", "ammonium", "superphosphate",
    "chlorpyrifos", "imidacloprid", "cypermethrin",
    "endosulfan", "glyphosate", "carbofuran", "monocrotophos",
]


def _strip_chemicals(text: str) -> str:
    for term in CHEMICAL_BLOCKLIST:
        if term.lower() in text.lower():
            text = re.sub(
                rf'[^।.!?\n]*{re.escape(term)}[^।.!?\n]*[।.!?\n]?',
                '',
                text,
                flags=re.IGNORECASE
            )
    return text.strip()


async def _call_mistral(system: str, user_message: str, history: list | None = None) -> str:
    """Call Mistral REST API. Injects conversation history for follow-up support. Hard 20s timeout."""
    api_key = os.environ.get('MISTRAL_API_KEY', '').strip()
    model = os.environ.get('MISTRAL_MODEL', 'mistral-small-latest')

    if not api_key:
        print('[M5] ERROR: MISTRAL_API_KEY not set!')
        return KVK_REDIRECT_KN

    # Build messages array: system + history (last 6 turns) + current question
    messages = [{'role': 'system', 'content': system}]
    if history:
        # Keep last 6 messages (3 exchanges) to stay within token budget
        for h in history[-6:]:
            messages.append({'role': h['role'], 'content': h['content']})
    messages.append({'role': 'user', 'content': user_message})

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            'https://api.mistral.ai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': model,
                'messages': messages,
                'temperature': 0.2,
                'max_tokens': 400,
            }
        )

    if resp.status_code == 200:
        text = resp.json()['choices'][0]['message']['content'].strip()
        print(f'[M5] Mistral OK — {len(text)} chars')
        return _strip_chemicals(text)
    else:
        print(f'[M5] Mistral error {resp.status_code}: {resp.text[:200]}')
        return KVK_REDIRECT_KN


async def generate(
    nlp_result,
    farmer_name: str = 'ರೈತರೇ',
    skb_record: dict | None = None,
    rag_chunks: list | None = None,
    conversation_history: list | None = None,
    tts_language: str = 'kn',
) -> tuple[str, list[str]]:
    """
    Main M5 entry point.
    Returns (answer_text, sources_list)
    conversation_history: list of {role, content} dicts for follow-up support.
    tts_language: language code for response generation (kn, en, hi, ta, te, ml, etc.)
    """
    from models.schemas import Intent

    rag_chunks = rag_chunks or []

    # ── Handle special intents without any LLM call ────────────────
    if nlp_result.intent == Intent.OUT_OF_DOMAIN:
        return OUT_OF_DOMAIN_KN, []
    if nlp_result.intent == Intent.COMING_SOON:
        return COMING_SOON_KN, []

    # ── Build context from RAG chunks ──────────────────────────────
    district = nlp_result.entities.get('district') or ''
    crop = nlp_result.entities.get('crop_name') or ''

    # Extract district/crop from conversation history if not in current message
    if conversation_history and (not district or not crop):
        for msg in conversation_history:
            content = msg.content if hasattr(msg, 'content') else str(msg)
            if not district:
                # Look for district mentions in past messages
                import re
                for d_name in ['Ballari', 'Bellary', 'Dharwad', 'Bangalore', 'Mysore', 'Hubli',
                               'Belgaum', 'Gulbarga', 'Raichur', 'Shimoga', 'Tumkur', 'Hassan',
                               'Mandya', 'Chitradurga', 'Davangere', 'Koppal', 'Gadag', 'Haveri',
                               'ಬಳ್ಳಾರಿ', 'ಧಾರವಾಡ', 'ಬೆಂಗಳೂರು', 'ಮೈಸೂರು', 'ಹುಬ್ಬಳ್ಳಿ',
                               'ಬೆಳಗಾವಿ', 'ಗುಲ್ಬರ್ಗ', 'ರಾಯಚೂರು', 'ಶಿವಮೊಗ್ಗ', 'ತುಮಕೂರು',
                               'ಹಾಸನ', 'ಮಂಡ್ಯ', 'ಚಿತ್ರದುರ್ಗ', 'ದಾವಣಗೆರೆ', 'ಕೊಪ್ಪಳ']:
                    if d_name.lower() in content.lower() or d_name in content:
                        district = d_name
                        break

    district = district or 'Karnataka'
    crop = crop or ''

    context_block = ''
    sources = []

    # SKB record (structured knowledge base — Shinan's data)
    if skb_record:
        context_block += f"\n\nVERIFIED RECIPE FROM {skb_record.get('primary_source', 'Palekar ZBNF')}:\n"
        for ing in skb_record.get('ingredients', []):
            context_block += f"  • {ing['quantity']} {ing['unit']} {ing['name_en']}\n"
        for i, step in enumerate(skb_record.get('preparation_steps', []), 1):
            context_block += f"  Step {i}: {step}\n"
        sources.append(skb_record.get('primary_source', 'Palekar ZBNF Vol 1'))

    # RAG chunks from Supabase (Rikash's embedded documents)
    if rag_chunks:
        context_block += "\n\nRELEVANT KNOWLEDGE FROM VERIFIED SOURCES:\n"
        for i, chunk in enumerate(rag_chunks[:5], 1):
            context_block += f"\n--- Source {i}: {chunk.source_doc} (p.{chunk.source_page}) ---\n"
            context_block += f"{chunk.content}\n"
            # Add unique sources
            cite = chunk.citation()
            if cite not in sources:
                sources.append(cite)
        context_block += "\n\nIMPORTANT: Use the above verified knowledge to answer. Cite sources when possible."

    # Map language code to Sarvam format for the TARGET LANGUAGE instruction
    LANG_NAMES = {
        'kn': 'kn-IN (Kannada)', 'en': 'en-IN (English)', 'hi': 'hi-IN (Hindi)',
        'ta': 'ta-IN (Tamil)', 'te': 'te-IN (Telugu)', 'ml': 'ml-IN (Malayalam)',
        'mr': 'mr-IN (Marathi)', 'bn': 'bn-IN (Bengali)', 'gu': 'gu-IN (Gujarati)',
        'pa': 'pa-IN (Punjabi)', 'od': 'od-IN (Odia)',
    }
    target_lang = LANG_NAMES.get(tts_language, 'kn-IN (Kannada)')

    user_message = (
        f"Farmer: {farmer_name}\n"
        f"District: {district}, Karnataka\n"
        f"Crop: {crop}\n"
        f"TARGET LANGUAGE: {target_lang}\n"
        f"Question: {nlp_result.raw_transcript}"
        f"{context_block}"
    )

    # Convert ConversationMessage objects to plain dicts for Mistral
    history_dicts = None
    if conversation_history:
        history_dicts = [{'role': m.role, 'content': m.content} for m in conversation_history]

    answer = await _call_mistral(SYSTEM_PROMPT, user_message, history=history_dicts)

    if not sources:
        sources = ['ಸುಭಾಷ್ ಪಾಲೇಕರ್ ZBNF', 'ICAR ಸಾವಯವ ಕೃಷಿ ಮಾರ್ಗದರ್ಶಿ']

    return answer, sources

