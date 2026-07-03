"""
Module M5 — Response Generator
Uses Gemini 2.0 Flash as PRIMARY LLM for response generation.
Mistral is the FALLBACK if Gemini fails.

Architecture:
  NLP result + SKB record + RAG chunks → Gemini → answer in user's language → TTS
"""

import httpx
import os
import re

from typing import Any
from modules import m3_structured_kb

# ── Mistral system prompt — HUMAN-LIKE, ADAPTIVE ─────────────────
SYSTEM_PROMPT = """You are KrishiMitra — a wise, experienced Karnataka farmer who has practiced organic farming for 35+ years. You speak like a warm, knowledgeable neighbor — NOT like a textbook, and NOT like an AI.

PERSONALITY:
- Warm, patient, encouraging — like a trusted village elder. Use colloquial Kannada terms naturally.
- Sound like a real human having a warm, face-to-face conversation.
- Talk like a neighbor offering genuine advice based on real experience.

RESPONSE STYLE (CRITICAL):
- BE BRIEF by default. Answer only what is asked in 1-3 natural sentences.
- For crop recommendations: Recommend ONLY the single best crop (or maximum two) suited for their requested duration and district. Give a warm sentence explaining the soil suitability, and a direct math breakdown of the yield, price, and net profit in simple flowing prose. Do NOT list multiple alternative crops. Keep the response under 4-5 sentences total.
- NEVER mention "Palekar" or specific sources in your speech unless the user specifically asks who provided the method. Just share the knowledge as your own experience.
- The user sees sources in the UI, so do NOT read them out loud.

VOICE FORMATTING (your response will be SPOKEN ALOUD):
- Address farmer by name (e.g. 'ಶಕೀಬ್ ಅಣ್ಣಾ' or 'ಶಕೀಬ್') if provided.
- NEVER use bullet points, numbered lists, asterisks (*), bold formatting, or headings — write in flowing, warm prose.
- Use simple words that any farmer can understand.

LANGUAGE RULES:
- Language mapping: kn-IN=Kannada, hi-IN=Hindi, ta-IN=Tamil, te-IN=Telugu, ml-IN=Malayalam, mr-IN=Marathi, bn-IN=Bengali, gu-IN=Gujarati, pa-IN=Punjabi, or-IN=Odia, en-IN=English.
- Respond ENTIRELY in the target language's native script.

DOMAIN:
- ONLY answer about agriculture, farming, pests, organic methods.
- NEVER suggest chemicals — ONLY organic (Jeevamrutha, Neem oil, etc.).
- If asked about non-farming topics: politely refuse in 1 short sentence."""

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

    try:
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
    except Exception as e:
        print(f'[M5] Mistral failed: {e}')
    
    return ''

async def _call_gemini(system: str, user_message: str, history: list | None = None) -> str:
    """PRIMARY LLM — Gemini 2.0 Flash. Better quality for Indian languages."""
    key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not key:
        print('[M5] ERROR: GEMINI_API_KEY not set!')
        return ''
        
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}'
    
    parts = []
    parts.append({'text': f"SYSTEM PROMPT (Follow strictly):\n{system}\n\n"})
    
    if history:
        for h in history[-6:]:
            prefix = "Farmer" if h['role'] == 'user' else "KrishiMitra"
            parts.append({'text': f"{prefix}: {h['content']}\n"})
            
    parts.append({'text': f"Farmer: {user_message}\nKrishiMitra:"})
    
    payload = {
        'contents': [{'parts': parts}],
        'generationConfig': {
            'temperature': 0.3,
            'maxOutputTokens': 500,
        },
    }
    
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(url, json=payload)
            
        if resp.status_code == 200:
            text = resp.json()['candidates'][0]['content']['parts'][0]['text'].strip()
            print(f'[M5] Gemini OK — {len(text)} chars')
            return _strip_chemicals(text)
        else:
            print(f'[M5] Gemini error {resp.status_code}: {resp.text[:200]}')
    except Exception as e:
        print(f'[M5] Gemini failed: {e}')
        
    return ''


async def generate(
    nlp_result,
    farmer_name: str = 'ರೈತರೇ',
    skb_record: dict | None = None,
    rag_chunks: list | None = None,
    conversation_history: list | None = None,
    preferred_language: str = 'kn-IN',
    tts_language: str | None = None,
    user_context: Any = None,
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
    district = (user_context.district if user_context else None) or nlp_result.entities.get('district') or ''
    crop = (user_context.primary_crop if user_context else None) or nlp_result.entities.get('crop_name') or ''

    # Extract district/crop from conversation history if not in current message
    if conversation_history and (not district or not crop):
        for msg in conversation_history:
            content = msg.content if hasattr(msg, 'content') else str(msg)
            if not district:
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

    # Clear history if district context changed to prevent recommendation bleed-through
    if conversation_history and district:
        from routers.weather import DISTRICT_COORDS
        curr_d = district.lower().strip()
        history_has_different_district = False
        for msg in conversation_history:
            content_lower = (msg.content.lower() if hasattr(msg, 'content') else str(msg).lower())
            for d_name in DISTRICT_COORDS.keys():
                # Fuzzy check
                if d_name in content_lower and d_name not in curr_d and curr_d not in d_name:
                    history_has_different_district = True
                    break
            if history_has_different_district:
                break
        
        if history_has_different_district:
            print(f"[M5] District change detected in history (current: {district}). Clearing history context.")
            conversation_history = None

    # Check if this is a crop recommendation query
    query_lower = nlp_result.raw_transcript.lower() if nlp_result.raw_transcript else ""
    if nlp_result.normalised_query:
        query_lower += " " + nlp_result.normalised_query.lower()

    recommendation_keywords = [
        "grow", "sow", "plant", "recommend", "which crop", "what to grow", "suggest",
        "ಬೆಳೆ", "ಬೆಳೆಯಲು", "ಯಾವ ಬೆಳೆ", "ಬಿತ್ತನೆ", "ಹಾಕಬೇಕು", "ಹಾಕೋದು", "ಯಾವುದು ಉತ್ತಮ",
        "ಬೆಳೆಯೋದು", "ಒಳ್ಳೆಯದು", "ಹಣ", "ಗಳಿಸಬಹುದು"
    ]
    is_rec_query = any(kw in query_lower for kw in recommendation_keywords)

    rec_context = ""
    if is_rec_query:
        # Check if another district was mentioned in the query text
        mentioned_district = None
        from routers.weather import DISTRICT_COORDS
        for d_name in DISTRICT_COORDS.keys():
            if d_name in query_lower:
                mentioned_district = d_name.title()
                break
        
        if mentioned_district:
            district = mentioned_district
        elif not district or district.lower().strip() == 'karnataka':
            district = 'Dakshina Kannada'  # Default district

        # Extract duration
        duration_months = 6  # default
        months_match = re.search(r'(\d+)\s*(month|ತಿಂಗಳ|ತಿಂಗಳು)', query_lower)
        if months_match:
            try:
                duration_months = int(months_match.group(1))
            except:
                pass
        else:
            for word, val in [("three", 3), ("ಮೂರು", 3), ("six", 6), ("ಆರು", 6), ("one", 12), ("ಒಂದು", 12)]:
                if word in query_lower:
                    duration_months = val
                    break

        # Extract acreage
        acreage = 1.0  # default
        acre_match = re.search(r'(\d+)\s*(acre|ಎಕರೆ)', query_lower)
        if acre_match:
            try:
                acreage = float(acre_match.group(1))
            except:
                pass
        else:
            for word, val in [("four", 4.0), ("ನಾಲ್ಕು", 4.0), ("one", 1.0), ("ಒಂದು", 1.0), ("two", 2.0), ("ಎರಡು", 2.0), ("three", 3.0), ("ಮೂರು", 3.0), ("five", 5.0), ("ಐದು", 5.0)]:
                if word in query_lower:
                    acreage = val
                    break

        # Fetch current weather for the district (with a 1.5s timeout)
        weather_context = "The monsoon season is starting with favorable moderate humidity and regular rainfall."
        lat_val, lon_val = 12.87, 74.88  # Dakshina Kannada coords
        coords = DISTRICT_COORDS.get(district.lower().strip())
        if not coords:
            for dk, dv in DISTRICT_COORDS.items():
                if district.lower().strip() in dk or dk in district.lower().strip():
                    coords = dv
                    district = dk.title()
                    break
        if coords:
            lat_val, lon_val = coords
            try:
                url = f'https://api.open-meteo.com/v1/forecast?latitude={lat_val}&longitude={lon_val}&current=temperature_2m,precipitation,weather_code&forecast_days=3'
                async with httpx.AsyncClient(timeout=1.5) as client:
                    w_resp = await client.get(url)
                    if w_resp.status_code == 200:
                        w_data = w_resp.json()
                        temp = w_data.get("current", {}).get("temperature_2m", 25.0)
                        precip = w_data.get("current", {}).get("precipitation", 0.0)
                        weather_context = f"The current weather in {district} has a temperature of {temp}°C with {precip}mm rain, which is highly suitable."
            except Exception as we:
                print(f"[M5] Context weather fetch failed: {we}")

        # Resolve soil and recommended crops based on district
        d_lower = district.lower()
        if any(x in d_lower for x in ["dakshina kannada", "udupi", "uttara kannada", "mangalore"]):
            soil_kn = "ಕೆಂಪು ಜೇಡಿ ಮಣ್ಣು"
            soil_en = "red lateritic clayey soil"
            soil_source = "ICAR ವಲಯ 9ರ ಮಣ್ಣಿನ ನಕ್ಷೆಯ ವರದಿ"
            rec_crops = [
                {"name_en": "Paddy", "name_kn": "ಭತ್ತ", "yield_val": 18, "modal_price": 2400, "cost_val": 15000, "duration_months": 4},
                {"name_en": "Ginger", "name_kn": "ಶುಂಠಿ", "yield_val": 60, "modal_price": 4000, "cost_val": 60000, "duration_months": 6}
            ]
        elif any(x in d_lower for x in ["tumakuru", "tumkur", "hassan", "chikkaballapur", "kolar", "mandya", "mysuru", "mysore", "bengaluru", "bangalore"]):
            soil_kn = "ಕೆಂಪು ಮರಳು ಮಿಶ್ರಿತ ಮಣ್ಣು"
            soil_en = "red loamy and sandy soil"
            soil_source = "ICAR ವಲಯ 5ರ ಮಣ್ಣಿನ ನಕ್ಷೆಯ ವರದಿ"
            rec_crops = [
                {"name_en": "Ragi", "name_kn": "ರಾಗಿ", "yield_val": 14, "modal_price": 3500, "cost_val": 12000, "duration_months": 4},
                {"name_en": "Potato", "name_kn": "ಆಲೂಗಡ್ಡೆ", "yield_val": 80, "modal_price": 2000, "cost_val": 40000, "duration_months": 4}
            ]
        else:
            soil_kn = "ಕಪ್ಪು ಮಣ್ಣು"
            soil_en = "black clayey soil"
            soil_source = "ICAR ವಲಯ 2/3ರ ಮಣ್ಣಿನ ನಕ್ಷೆಯ ವರದಿ"
            rec_crops = [
                {"name_en": "Jowar", "name_kn": "ಜೋಳ", "yield_val": 10, "modal_price": 3000, "cost_val": 10000, "duration_months": 4},
                {"name_en": "Maize", "name_kn": "ಮೆಕ್ಕೆ ಜೋಳ", "yield_val": 22, "modal_price": 2100, "cost_val": 15000, "duration_months": 4}
            ]

        # Select the single best crop fitting duration (fallback to first if none fit)
        suitable_crops = [c for c in rec_crops if c['duration_months'] <= duration_months]
        if not suitable_crops:
            suitable_crops = rec_crops
        # Sort by net profit descending
        suitable_crops.sort(key=lambda x: (x['yield_val'] * x['modal_price'] - x['cost_val']), reverse=True)
        best_crop = suitable_crops[0]

        # Convert float/int formatted properly without fractions if they are integers
        def format_num(val) -> str:
            if isinstance(val, float) and val.is_integer():
                return str(int(val))
            return str(val)

        # Do exact math in Python
        total_yield = best_crop['yield_val'] * acreage
        total_revenue = total_yield * best_crop['modal_price']
        total_cost = best_crop['cost_val'] * acreage
        total_net_profit = total_revenue - total_cost

        # Convert to local numbers for display (formatted cleanly)
        total_yield_str = format_num(total_yield)
        total_revenue_str = f"{int(total_revenue):,}"
        total_cost_str = f"{int(total_cost):,}"
        total_net_profit_str = f"{int(total_net_profit):,}"

        math_explanation_kn = (
            f"ನಿಮ್ಮ {format_num(acreage)} ಎಕರೆಯಲ್ಲಿ {best_crop['name_kn']} ಬೆಳೆದರೆ, ಎಕರೆಗೆ {best_crop['yield_val']} ಕ್ವಿಂಟಾಲ್‌ನಂತೆ ಒಟ್ಟು {total_yield_str} ಕ್ವಿಂಟಾಲ್ ಇಳುವರಿ ಬರಬಹುದು. "
            f"ಪ್ರಸ್ತುತ ಕ್ವಿಂಟಾಲ್‌ಗೆ ₹{best_crop['modal_price']} ದರದಲ್ಲಿ ಒಟ್ಟು ಆದಾಯ ₹{total_revenue_str} ಆಗುತ್ತದೆ. "
            f"ಇದರಲ್ಲಿ ಒಟ್ಟು ಬೇಸಾಯದ ವೆಚ್ಚ ₹{total_cost_str} ಕಳೆದು ನಿಮಗೆ ಸುಮಾರು ₹{total_net_profit_str} ನಿವ್ವಳ ಲಾಭ ಸಿಗಬಹುದು."
        )

        math_explanation_en = (
            f"If you grow {best_crop['name_en']} on your {format_num(acreage)} acres, you can expect a yield of {best_crop['yield_val']} quintals per acre, totaling {total_yield_str} quintals. "
            f"At the current price of ₹{best_crop['modal_price']} per quintal, your total revenue will be ₹{total_revenue_str}. "
            f"Deducting the total cultivation cost of ₹{total_cost_str}, your net profit will be approximately ₹{total_net_profit_str}."
        )

        soil_reason_kn = f"ಕರ್ನಾಟಕ ಸರ್ಕಾರದ ಕೃಷಿ ಇಲಾಖೆ ಹಾಗೂ {soil_source} ಪ್ರಕಾರ ನಿಮ್ಮ ಜಿಲ್ಲೆಯ ಮಣ್ಣು ಮುಖ್ಯವಾಗಿ {soil_kn} ಆಗಿದೆ."
        soil_reason_en = f"According to the official soil mapping from the Karnataka Agriculture Department and {soil_source}, the soil in your district is primarily {soil_en}."

        rec_context = f"\nRECOMMENDATION CONTEXT (USE THIS TO ANSWER):\n"
        rec_context += f"- Target Crop: {best_crop['name_en']} ({best_crop['name_kn']})\n"
        rec_context += f"- Crop Sowing Duration: {best_crop['duration_months']} months\n"
        rec_context += f"- Soil Suitability Basis: {soil_reason_kn} / {soil_reason_en}\n"
        rec_context += f"- Grounded Math Explanation (Kannada): {math_explanation_kn}\n"
        rec_context += f"- Grounded Math Explanation (English): {math_explanation_en}\n"

        rec_context += "\nCRITICAL RESPONSE GUIDELINES:\n"
        rec_context += f"1. Match Sowing Duration: Tell the farmer that since they asked for a crop for the next {duration_months} months, growing {best_crop['name_kn']} is recommended as it yields in {best_crop['duration_months']} months.\n"
        rec_context += f"2. Address Acreage: Address the farmer's land size of {format_num(acreage)} acres directly.\n"
        rec_context += "3. Explain the Math: You MUST COPY the Grounded Math Explanation sentence EXACTLY word-for-word into your response. Do NOT change the numbers, words, or calculations.\n"
        rec_context += "4. Soil validation: When explaining how you know their soil type, state the Soil Suitability Basis directly.\n"
        rec_context += "5. Style: Respond in warm, flowing prose (no bullet points, no markdown, no asterisks, no list layout) in target language script, keeping it under 3-4 sentences total.\n"

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
        f"{rec_context}"
    )

    # Convert ConversationMessage objects to plain dicts for Mistral
    history_dicts = None
    if conversation_history:
        history_dicts = [{'role': m.role, 'content': m.content} for m in conversation_history]

    answer = await _call_gemini(SYSTEM_PROMPT, user_message, history=history_dicts)
    
    if not answer.strip():
        print('[M5] Gemini failed, falling back to Mistral...')
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
