"""
Module M5 — Response Generator
Responsibility: Assemble final Kannada response from RAG chunks (M3) and/or diagnosis (M4).
Call Gemini LLM to synthesise, translate, and format.

GOLDEN RULE enforced here:
- Source cited on every response
- Under 150 words
- Never chemical inputs
- Kannada output only
"""

import google.generativeai as genai
import os
import re
from models.schemas import NLPResult, Intent
from modules.m3_rag import RAGChunk
from modules import m6_guard

genai.configure(api_key=os.environ.get('GEMINI_API_KEY', ''), transport='rest')

# ── System Prompt (LOCKED — Do not change without team review) ───

SYSTEM_PROMPT = '''
ನೀವು KrishiMitra, ಕರ್ನಾಟಕ ಜೈವಿಕ ಕೃಷಿ ರೈತರಿಗಾಗಿ ಒಂದು AI ಸಲಹೆಗಾರ.
You are KrishiMitra, an AI advisor for Karnataka organic farmers.

STRICT RULES (non-negotiable):
1. Answer ONLY using the provided Context below.
2. NEVER suggest chemical fertilisers (urea, DAP, NPK, MOP, ammonium sulphate).
3. NEVER suggest chemical pesticides (chlorpyrifos, imidacloprid, cypermethrin, etc.).
4. ALWAYS respond in Kannada language (ಕನ್ನಡ).
5. ALWAYS end your answer with: 'ಮೂಲ: [source name]'
6. Keep answer under 150 words (for voice delivery).
7. Use simple language appropriate for low-literacy farmers.
8. If you cannot answer from the context, respond exactly:
   'ಈ ವಿಷಯದ ಬಗ್ಗೆ ನಮ್ಮ ದತ್ತಾಂಶದಲ್ಲಿ ನಿಖರ ಮಾಹಿತಿ ಇಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸ್ಥಳೀಯ KVK ಸಂಪರ್ಕಿಸಿ.'
9. Never mention that you are an AI or that you are using a database.
10. Be warm, respectful, and address the farmer as 'ನಿಮ್ಮ' (your/you formal).
'''

_llm = genai.GenerativeModel(
    os.environ.get('GEMINI_RESPONSE_MODEL', 'gemini-2.5-flash'),
    system_instruction=SYSTEM_PROMPT,
)

# ── Standard Response Constants ──────────────────────────────────

KVK_REDIRECT_KN = (
    'ಈ ವಿಷಯದ ಬಗ್ಗೆ ನಮ್ಮ ದತ್ತಾಂಶದಲ್ಲಿ ನಿಖರ ಮಾಹಿತಿ ಇಲ್ಲ. '
    'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸ್ಥಳೀಯ ಕೃಷಿ ವಿಜ್ಞಾನ ಕೇಂದ್ರ (KVK) ಅಥವಾ '
    'ರೈತ ಸಂಪರ್ಕ ಕೇಂದ್ರವನ್ನು ಸಂಪರ್ಕಿಸಿ.'
)

OUT_OF_DOMAIN_KN = (
    'ನಾನು ಕೇವಲ ಜೈವಿಕ ಕೃಷಿ ಮತ್ತು ಬೆಳೆ ನಿರ್ವಹಣೆ ಬಗ್ಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. '
    'ನಿಮ್ಮ ಬೆಳೆ, ಮಣ್ಣು ಅಥವಾ ಕೀಟ ನಿರ್ವಹಣೆ ಬಗ್ಗೆ ಕೇಳಿ.'
)

# ── Chemical terms to strip from LLM output ─────────────────────

CHEMICAL_TERMS_TO_STRIP = [
    'urea', 'DAP', 'NPK', 'ammonium', 'phosphate', 'potash', 'MOP',
    'chlorpyrifos', 'imidacloprid', 'cypermethrin', 'glyphosate',
    'endosulfan', 'carbofuran', 'monocrotophos',
]


def build_context_block(chunks: list) -> str:
    """Format retrieved RAG chunks into a context string for the LLM prompt."""
    lines = []
    for i, chunk in enumerate(chunks, 1):
        lines.append(f'[Context {i}] Source: {chunk.citation()}')
        lines.append(chunk.content)
        lines.append('')
    return '\n'.join(lines)


def strip_chemical_mentions(text: str) -> str:
    """
    Post-processing safety net: remove any chemical fertiliser/pesticide mentions
    that might have leaked through the LLM despite system prompt instructions.
    """
    for term in CHEMICAL_TERMS_TO_STRIP:
        if term.lower() in text.lower():
            # Replace the sentence containing chemical mention
            text = re.sub(
                rf'[^.]*{re.escape(term)}[^.]*\.?',
                '', text, flags=re.IGNORECASE,
            )
    return text.strip()


async def generate(nlp_result: NLPResult,
                   rag_chunks: list,
                   farmer_name: str = None) -> tuple:
    """
    Main M5 entry point for text query responses.
    
    Args:
        nlp_result: NLPResult from M2
        rag_chunks: List of RAGChunk from M3 (may be empty)
        farmer_name: Optional farmer name for personalised greeting
    
    Returns:
        (answer_text_kn: str, sources_list: list[str])
    """
    # Handle special cases without LLM call
    if nlp_result.intent == Intent.OUT_OF_DOMAIN:
        return OUT_OF_DOMAIN_KN, []

    if not rag_chunks:
        return KVK_REDIRECT_KN, []

    # Build prompt with RAG context
    context = build_context_block(rag_chunks)
    greeting = f'ನಮಸ್ಕಾರ {farmer_name},' if farmer_name else 'ನಮಸ್ಕಾರ,'

    prompt = f'''
{context}

Question: {nlp_result.normalised_query}
Original: {nlp_result.raw_transcript}

Please answer the farmer's question in Kannada using the context above.
Start with: {greeting}
End with: ಮೂಲ: [source name from context]
'''

    import asyncio
    response = await asyncio.to_thread(
        _llm.generate_content,
        prompt,
        generation_config={
            'temperature': 0.2,      # Low temperature for factual accuracy
            'max_output_tokens': 300,
            'top_p': 0.8,
        },
    )

    answer = response.text.strip()

    # Post-process: M6 Hallucination Guard
    guard_result = m6_guard.verify_response(answer, rag_chunks)
    answer = guard_result['verified_response']

    # Post-process: chemical filter (M6)
    answer, _ = m6_guard.filter_chemical_inputs(answer)

    # Legacy safety check
    answer = strip_chemical_mentions(answer)

    # Extract sources from RAG chunks
    sources = [chunk.citation() for chunk in rag_chunks]

    print(f'[M5] Grounding score: {guard_result["grounding_score"]}, '
          f'grounded: {len(guard_result["grounded_claims"])}, '
          f'ungrounded: {len(guard_result["ungrounded_claims"])}')

    return answer, sources


async def finding_to_kannada_text(finding, user_ctx) -> str:
    """
    Convert a DiagnosisFinding into a Kannada voice-friendly response.
    Used by both /api/diagnose and /api/query when diagnosis is performed.
    
    Args:
        finding: DiagnosisFinding from M4
        user_ctx: UserContext for personalisation
    
    Returns:
        Kannada text response (max 600 chars for TTS)
    """
    if finding.needs_retake:
        return ('ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟ ಬೆಳಕಿನಲ್ಲಿ ಎಲೆ ಅಥವಾ ಹಣ್ಣಿನ ಫೋಟೋ ತೆಗೆದು '
                'ಮತ್ತೊಮ್ಮೆ ಅಪ್ಲೋಡ್ ಮಾಡಿ.')

    if finding.plant_health_status.lower() == 'healthy':
        treatments = ' '.join(
            [f'{i+1}. {t}' for i, t in enumerate(finding.organic_treatments[:3])]
        ) if finding.organic_treatments else 'ಬೆಳೆಯ ಬೇರಿನ ಬಗ್ಗೆ ಕಾಳಜಿ ವಹಿಸಿ ಮತ್ತು ಸರಿಯಾದ ಸಮಯದಲ್ಲಿ ನೀರು ಹಾಯಿಸಿ.'
        return (
            f'ನಿಮ್ಮ ಸಸ್ಯ ಆರೋಗ್ಯಕರವಾಗಿದೆ! ಎಲೆಗಳು ಹಸಿರಾಗಿವೆ ಮತ್ತು ಯಾವುದೇ ರೋಗದ ಲಕ್ಷಣಗಳಿಲ್ಲ. '
            f'ಮತ್ತಷ್ಟು ಕಾಳಜಿ ವಹಿಸಲು: {treatments}'
        )

    if not finding.disease_name or finding.disease_name == 'Unable to identify':
        return KVK_REDIRECT_KN

    # Build structured response for diseased plant
    treatments = ' '.join(
        [f'{i+1}. {t}' for i, t in enumerate(finding.organic_treatments[:3])]
    )
    if not treatments:
        treatments = 'ಯಾವುದೇ ಜೈವಿಕ ಉಪಾಯ ಲಭ್ಯವಿಲ್ಲ, ದಯವಿಟ್ಟು KVK ಸಂಪರ್ಕಿಸಿ.'
    source_text = (
        ', '.join(finding.sources[:2])
        if finding.sources
        else 'Gemini Vision + NIPHM IPM'
    )

    response = (
        f'ನಿಮ್ಮ ಬೆಳೆಗೆ {finding.disease_name_kn or finding.disease_name} '
        f'ಕಾಣಿಸಿಕೊಂಡಿದೆ. '
        f'ಜೈವಿಕ ಉಪಾಯ: {treatments} '
        f'ಮೂಲ: {source_text}'
    )

    if not finding.is_reliable:
        response += (
            f' ಗಮನಿಸಿ: ಇದು ಕಡಿಮೆ ವಿಶ್ವಾಸದ ಅಂದಾಜು ({finding.confidence_pct}%). '
            'ಸಾಧ್ಯವಾದರೆ ಹತ್ತಿರದಿಂದ, ನೈಸರ್ಗಿಕ ಬೆಳಕಿನಲ್ಲಿ ಮತ್ತೊಂದು ಫೋಟೋ ಅಪ್ಲೋಡ್ ಮಾಡಿ.'
        )

    return response[:600]  # TTS character limit
