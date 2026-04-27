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
SYSTEM_PROMPT = """ನೀವು KrishiMitra — ಕರ್ನಾಟಕ ಜೈವಿಕ ಕೃಷಿ ರೈತರಿಗಾಗಿ AI ಸಲಹೆಗಾರ.
You are KrishiMitra, an organic farming advisor for Karnataka farmers.

YOUR ONLY JOB: Answer the farmer's question in warm, simple Kannada using verified organic farming knowledge.

STRICT RULES:
1. Answer ONLY in Kannada language.
2. NEVER suggest chemicals: urea, DAP, NPK, chlorpyrifos, imidacloprid, glyphosate, endosulfan.
3. ONLY recommend organic methods: Jeevamrutha, Beejamrutha, Gau Krupa Amrutha, Vermicompost, Neem, Panchagavya, mulching.
4. Keep answer under 150 words — it will be read aloud to farmers.
5. Use very simple language — farmers may be low-literacy.
6. Start with: ನಮಸ್ಕಾರ [farmer name],
7. End with: ಮೂಲ: ಸುಭಾಷ್ ಪಾಲೇಕರ್ ZBNF / ICAR
8. For Jeevamrutha: ingredients are — 200L water, 10kg fresh desi cow dung, 10L cow urine, 2kg jaggery, 2kg gram flour, handful of bund soil. Ferment 48 hours. Apply 200L/acre every 15 days.
9. Address the farmer warmly like a knowledgeable friend."""

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


async def _call_mistral(system: str, user_message: str) -> str:
    """Call Mistral REST API directly via httpx. Hard 20s timeout."""
    api_key = os.environ.get('MISTRAL_API_KEY', '').strip()
    model = os.environ.get('MISTRAL_MODEL', 'mistral-small-latest')

    if not api_key:
        print('[M5] ERROR: MISTRAL_API_KEY not set!')
        return KVK_REDIRECT_KN

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            'https://api.mistral.ai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': model,
                'messages': [
                    {'role': 'system', 'content': system},
                    {'role': 'user', 'content': user_message},
                ],
                'temperature': 0.15,
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
) -> tuple[str, list[str]]:
    """
    Main M5 entry point.
    Returns (answer_text_kn, sources_list)

    Phase 1: Direct Mistral call with embedded Palekar knowledge.
    Phase 2 (Week 3+): SKB + RAG context injected into prompt.
    """
    from models.schemas import Intent

    rag_chunks = rag_chunks or []

    # ── Handle special intents without any LLM call ────────────────
    if nlp_result.intent == Intent.OUT_OF_DOMAIN:
        return OUT_OF_DOMAIN_KN, []
    if nlp_result.intent == Intent.COMING_SOON:
        return COMING_SOON_KN, []

    # ── Build user message ─────────────────────────────────────────
    district = (nlp_result.entities.get('district') or
                getattr(nlp_result, 'user_ctx', None) and
                'Karnataka') or 'Karnataka'
    crop = nlp_result.entities.get('crop_name') or 'your crops'

    # If SKB record available (Phase 2+), inject exact recipe data
    context_block = ''
    sources = []
    if skb_record:
        context_block = f"\n\nVERIFIED RECIPE FROM {skb_record.get('primary_source', 'Palekar ZBNF')}:\n"
        for ing in skb_record.get('ingredients', []):
            context_block += f"  • {ing['quantity']} {ing['unit']} {ing['name_en']}\n"
        for i, step in enumerate(skb_record.get('preparation_steps', []), 1):
            context_block += f"  Step {i}: {step}\n"
        sources.append(skb_record.get('primary_source', 'Palekar ZBNF Vol 1'))

    user_message = (
        f"Farmer: {farmer_name}\n"
        f"District: {district}, Karnataka\n"
        f"Crop: {crop}\n"
        f"Question: {nlp_result.raw_transcript}"
        f"{context_block}"
    )

    answer = await _call_mistral(SYSTEM_PROMPT, user_message)

    if not sources:
        sources = ['ಸುಭಾಷ್ ಪಾಲೇಕರ್ ZBNF', 'ICAR ಸಾವಯವ ಕೃಷಿ ಮಾರ್ಗದರ್ಶಿ']

    return answer, sources
