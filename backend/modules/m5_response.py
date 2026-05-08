"""
Module M5 — Response Generator
Uses Mistral (mistral-small-latest) via REST API for all text synthesis.
Gemini is NOT used here — only in M4 for vision.

Architecture:
  NLP result + SKB record + RAG chunks → Mistral → answer in user's language → TTS
"""

import httpx
import os
import re

from modules import m3_structured_kb

# ── Mistral system prompt — HUMAN-LIKE, ADAPTIVE ─────────────────
SYSTEM_PROMPT = """You are KrishiMitra — a wise, experienced Karnataka farmer who has practiced organic farming for 35+ years. You speak like a warm, knowledgeable neighbour — NOT like a textbook, NOT like an AI.

PERSONALITY:
- Warm, patient, encouraging — like a trusted village elder
- Use natural phrases: "In my experience...", "What works well is..."
- Be practical and specific — exact quantities, timings, methods
- Sound like a real human having a conversation

RESPONSE LENGTH — MATCH THE QUESTION:
- Simple greeting or yes/no → 1 sentence
- Specific question (how to make jeevamrutha?) → 2-4 sentences with exact recipe/steps
- "Tell me more" or "explain in detail" → 5-8 sentences with thorough explanation
- NEVER pad a short answer. NEVER truncate a detailed request.

VOICE FORMATTING (your response will be SPOKEN ALOUD):
- Address farmer by name if provided
- No bullet points, no numbered lists, no headings — write in flowing prose
- No markdown, no asterisks, no bold text
- No "Source:" or "Reference:" citations at the end — sources are shown separately in the app
- Use simple words that any farmer can understand

LANGUAGE RULES:
- Check the TARGET LANGUAGE in the user message
- Respond ENTIRELY in that language's native script
- NEVER mix languages in one response
- Language mapping: kn-IN=Kannada, hi-IN=Hindi, ta-IN=Tamil, te-IN=Telugu, ml-IN=Malayalam, mr-IN=Marathi, bn-IN=Bengali, gu-IN=Gujarati, pa-IN=Punjabi, or-IN=Odia, en-IN=English

DOMAIN:
- ONLY answer about agriculture, farming, soil, pests, organic methods
- If asked non-farming topics: politely refuse in 1 sentence in the target language
- NEVER suggest chemical inputs — ONLY organic solutions
- When you have verified knowledge from the context, use it. When you don't, use your general farming knowledge but be honest about certainty.

JEEVAMRUTHA RECIPE (when asked):
200L water + 10kg desi cow dung + 10L cow urine + 2kg jaggery + 2kg besan flour + a handful of soil from under a tree. Ferment 48 hours in shade, stirring twice daily. Apply 200L per acre every 15 days."""

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


def _out_of_domain_msg(lang: str) -> str:
    """Generate out-of-domain message in the user's language."""
    msgs = {
        'kn-IN': 'ನಾನು ಕೇವಲ ಕೃಷಿ ಮತ್ತು ಸಾವಯವ ಕೃಷಿ ಬಗ್ಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ಕೃಷಿ ಸಂಬಂಧಿತ ಪ್ರಶ್ನೆ ಕೇಳಿ.',
        'hi-IN': 'मैं केवल कृषि और जैविक खेती के बारे में मदद कर सकता हूँ। कृपया खेती संबंधित प्रश्न पूछें।',
        'ta-IN': 'நான் விவசாயம் மற்றும் இயற்கை வேளாண்மை பற்றி மட்டுமே உதவ முடியும்.',
        'te-IN': 'నేను వ్యవసాయం మరియు సేంద్రీయ వ్యవసాయం గురించి మాత్రమే సహాయం చేయగలను.',
        'ml-IN': 'എനിക്ക് കൃഷിയെയും ജൈവ കൃഷിയെയും കുറിച്ച് മാത്രമേ സഹായിക്കാൻ കഴിയൂ.',
        'mr-IN': 'मी केवळ शेती आणि सेंद्रिय शेतीबद्दल मदत करू शकतो.',
        'bn-IN': 'আমি শুধুমাত্র কৃষি এবং জৈব চাষ সম্পর্কে সাহায্য করতে পারি।',
        'gu-IN': 'હું ફક્ત ખેતી અને જૈવિક ખેતી વિશે મદદ કરી શકું છું.',
        'pa-IN': 'ਮੈਂ ਸਿਰਫ਼ ਖੇਤੀ ਅਤੇ ਜੈਵਿਕ ਖੇਤੀ ਬਾਰੇ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ।',
        'or-IN': 'ମୁଁ କେବଳ କୃଷି ଏବଂ ଜୈବିକ ଚାଷ ବିଷୟରେ ସାହାଯ୍ୟ କରିପାରିବି।',
        'en-IN': 'I can only help with farming and organic agriculture. Please ask a farming-related question.',
    }
    return msgs.get(lang, msgs['kn-IN'])


async def _call_mistral(system: str, user_message: str, history: list | None = None) -> str:
    """Call Mistral REST API. Injects conversation history for follow-up support. Hard 20s timeout."""
    api_key = os.environ.get('MISTRAL_API_KEY', '').strip()
    model = os.environ.get('MISTRAL_MODEL', 'mistral-small-latest')

    if not api_key:
        print('[M5] ERROR: MISTRAL_API_KEY not set!')
        return ''

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
                'temperature': 0.3,
                'max_tokens': 500,
            }
        )

    if resp.status_code == 200:
        text = resp.json()['choices'][0]['message']['content'].strip()
        print(f'[M5] Mistral OK — {len(text)} chars')
        return _strip_chemicals(text)
    else:
        print(f'[M5] Mistral error {resp.status_code}: {resp.text[:200]}')
        return ''


async def generate(
    nlp_result,
    farmer_name: str = 'ರೈತರೇ',
    skb_record: dict | None = None,
    rag_chunks: list | None = None,
    conversation_history: list | None = None,
    preferred_language: str = 'kn-IN',
    tts_language: str | None = None,
) -> tuple[str, list[str]]:
    """
    Main M5 entry point.
    Returns (answer_text, sources_list)
    """
    from models.schemas import Intent

    rag_chunks = rag_chunks or []
    language_code = (preferred_language or tts_language or 'kn-IN').strip()

    # ── Handle special intents without any LLM call ────────────────
    if nlp_result.intent == Intent.OUT_OF_DOMAIN:
        return _out_of_domain_msg(language_code), []

    # ── Build context from RAG chunks ──────────────────────────────
    district = nlp_result.entities.get('district') or ''
    crop = nlp_result.entities.get('crop_name') or ''

    # Extract district/crop from conversation history if not in current message
    if conversation_history and (not district or not crop):
        for msg in conversation_history:
            content = msg.content if hasattr(msg, 'content') else str(msg)
            if not district:
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

    # SKB record (structured knowledge base)
    if skb_record:
        context_block += f"\n\nVERIFIED RECIPE FROM {skb_record.get('primary_source', 'Organic Farming Guide')}:\n"

        raw_ingredients = skb_record.get('ingredients', [])
        if isinstance(raw_ingredients, list):
            for ing in raw_ingredients:
                if isinstance(ing, dict):
                    qty = ing.get('quantity', '')
                    unit = ing.get('unit', '')
                    name = ing.get('name_en') or ing.get('item') or ing.get('name_kn') or ''
                    context_block += f"  • {qty} {unit} {name}".strip() + "\n"
                else:
                    context_block += f"  • {str(ing)}\n"
        else:
            context_block += f"  • {str(raw_ingredients)}\n"

        steps = skb_record.get('preparation_steps') or skb_record.get('preparation_steps_en') or []
        if isinstance(steps, list):
            for i, step in enumerate(steps, 1):
                context_block += f"  Step {i}: {step}\n"
        elif steps:
            context_block += f"  Step 1: {steps}\n"

        sources.append(skb_record.get('primary_source', 'Organic Farming Guide'))

    # RAG chunks from Supabase
    if rag_chunks:
        context_block += "\n\nRELEVANT KNOWLEDGE FROM VERIFIED SOURCES:\n"
        for i, chunk in enumerate(rag_chunks[:5], 1):
            context_block += f"\n--- Source {i}: {chunk.source_doc} (p.{chunk.source_page}) ---\n"
            context_block += f"{chunk.content}\n"
            cite = chunk.citation()
            if cite not in sources:
                sources.append(cite)
        context_block += "\n\nUse the above verified knowledge to answer. Weave the information naturally into your response."

    # Map language code to readable name
    LANG_NAMES = {
        'kn-IN': 'Kannada (ಕನ್ನಡ)', 'kn': 'Kannada (ಕನ್ನಡ)',
        'en-IN': 'English', 'en': 'English',
        'hi-IN': 'Hindi (हिंदी)', 'hi': 'Hindi (हिंदी)',
        'ta-IN': 'Tamil (தமிழ்)', 'ta': 'Tamil (தமிழ்)',
        'te-IN': 'Telugu (తెలుగు)', 'te': 'Telugu (తెలుగు)',
        'ml-IN': 'Malayalam (മലയാളം)', 'ml': 'Malayalam (മലയാളം)',
        'mr-IN': 'Marathi (मराठी)', 'mr': 'Marathi (मराठी)',
        'bn-IN': 'Bengali (বাংলা)', 'bn': 'Bengali (বাংলা)',
        'gu-IN': 'Gujarati (ગુજરાતી)', 'gu': 'Gujarati (ગુજરાતી)',
        'pa-IN': 'Punjabi (ਪੰਜਾਬੀ)', 'pa': 'Punjabi (ਪੰਜਾਬੀ)',
        'or-IN': 'Odia (ଓଡ଼ିଆ)', 'od': 'Odia (ଓଡ଼ିଆ)',
    }
    target_lang = LANG_NAMES.get(language_code, 'Kannada (ಕನ್ನಡ)')

    user_message = (
        f"Farmer: {farmer_name}\n"
        f"District: {district}\n"
        f"Crop: {crop}\n"
        f"TARGET LANGUAGE: {target_lang} — respond ENTIRELY in this language\n"
        f"Question: {nlp_result.raw_transcript}"
        f"{context_block}"
    )

    # Convert ConversationMessage objects to plain dicts for Mistral
    history_dicts = None
    if conversation_history:
        history_dicts = [{'role': m.role, 'content': m.content} for m in conversation_history]

    answer = await _call_mistral(SYSTEM_PROMPT, user_message, history=history_dicts)

    if skb_record and not answer.strip():
        answer = m3_structured_kb.format_recipe_for_response(skb_record)

    if not answer.strip():
        # Fallback message in user's language
        fallbacks = {
            'kn-IN': 'ಕ್ಷಮಿಸಿ, ಸರ್ವರ್ ಸ್ವಲ್ಪ ನಿಧಾನವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಕೇಳಿ.',
            'hi-IN': 'क्षमा करें, सर्वर धीमा है। कृपया दोबारा पूछें।',
            'en-IN': 'Sorry, the server is slow right now. Please try again.',
        }
        answer = fallbacks.get(language_code, fallbacks['kn-IN'])

    # Don't add fake sources — only return what we actually have
    return answer, sources
