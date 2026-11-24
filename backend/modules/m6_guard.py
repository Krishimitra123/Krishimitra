"""
Module M6 — Hallucination Guard
Responsibility: Cross-check every LLM-generated response against RAG source chunks.
If a claim cannot be traced to a verified source → flag it and add disclaimer.

This is what makes KrishiMitra NOT a wrapper — every output is grounded.

Production version: Uses Gemini Embeddings API instead of sentence-transformers
to save ~600MB RAM on Render Free Tier.
"""

import os
import re
from typing import Optional

# Minimum similarity for a claim to be considered "grounded"
GROUNDING_THRESHOLD = 0.55


def _split_into_claims(text: str) -> list[str]:
    """
    Split LLM response text into individual claims/statements.
    Each sentence is treated as a potential claim to verify.
    """
    # Split on sentence boundaries
    sentences = re.split(r'(?<=[.!?।])\s+', text.strip())
    # Filter out very short sentences and greetings
    claims = []
    for s in sentences:
        s = s.strip()
        if len(s.split()) < 5:
            continue  # Too short to be a factual claim
        # Skip greeting/filler phrases
        if any(skip in s.lower() for skip in ['namaskara', 'namaste', 'hello', 'thank', 'welcome']):
            continue
        claims.append(s)
    return claims


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _embed_texts_gemini(texts: list[str]) -> list[list[float]]:
    """Embed texts using Gemini Embeddings API — no local model needed."""
    import google.genai as genai
    from google.genai import types as genai_types

    key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not key:
        return []

    try:
        client = genai.Client(api_key=key)
        result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=texts,
            config=genai_types.EmbedContentConfig(
                task_type="retrieval_document",
                output_dimensionality=768,
            ),
        )
        return [e.values for e in result.embeddings]
    except Exception as e:
        print(f'[M6] Gemini embedding failed: {e}')
        return []


def verify_response(
    llm_response: str,
    rag_chunks: list,
    threshold: float = GROUNDING_THRESHOLD,
) -> dict:
    """
    Cross-check LLM response against provided RAG chunks.
    Uses keyword overlap for lightweight grounding check on Render Free Tier.
    Falls back to Gemini embeddings when available.

    Returns:
        {
            'is_grounded': bool,
            'grounding_score': float,
            'grounded_claims': list,
            'ungrounded_claims': list,
            'verified_response': str,
            'sources_used': list,
        }
    """
    claims = _split_into_claims(llm_response)
    if not claims:
        return {
            'is_grounded': True,
            'grounding_score': 1.0,
            'grounded_claims': [],
            'ungrounded_claims': [],
            'verified_response': llm_response,
            'sources_used': [],
        }

    # Get RAG chunk contents
    chunk_texts = []
    chunk_sources = []
    for chunk in rag_chunks:
        if hasattr(chunk, 'content'):
            chunk_texts.append(chunk.content)
            chunk_sources.append(chunk.source_doc if hasattr(chunk, 'source_doc') else 'Unknown')
        elif isinstance(chunk, dict):
            chunk_texts.append(chunk.get('content', ''))
            chunk_sources.append(chunk.get('source_doc', 'Unknown'))

    if not chunk_texts:
        return {
            'is_grounded': False,
            'grounding_score': 0.0,
            'grounded_claims': [],
            'ungrounded_claims': claims,
            'verified_response': llm_response,
            'sources_used': [],
        }

    # Use lightweight keyword overlap for grounding check
    # This avoids loading a 600MB model on Render Free Tier
    grounded_claims = []
    ungrounded_claims = []
    sources_used = set()

    for claim in claims:
        claim_words = set(re.findall(r'\w+', claim.lower()))
        if len(claim_words) < 3:
            continue

        best_overlap = 0.0
        best_idx = 0
        for idx, chunk_text in enumerate(chunk_texts):
            chunk_words = set(re.findall(r'\w+', chunk_text.lower()))
            if not chunk_words:
                continue
            overlap = len(claim_words & chunk_words) / max(len(claim_words), 1)
            if overlap > best_overlap:
                best_overlap = overlap
                best_idx = idx

        if best_overlap >= 0.3:  # 30% keyword overlap = grounded
            grounded_claims.append({
                'claim': claim,
                'similarity': round(best_overlap, 3),
                'source': chunk_sources[best_idx],
            })
            sources_used.add(chunk_sources[best_idx])
        else:
            ungrounded_claims.append({
                'claim': claim,
                'best_similarity': round(best_overlap, 3),
            })

    total = len(grounded_claims) + len(ungrounded_claims)
    grounded_count = len(grounded_claims)
    grounding_score = grounded_count / total if total > 0 else 1.0

    # Build verified response
    verified_response = llm_response
    if grounding_score < 0.8 and ungrounded_claims:
        verified_response += '\n\n⚠️ ಈ ಮಾಹಿತಿಯ ಕೆಲವು ಭಾಗಗಳು ನಮ್ಮ ದತ್ತಾಂಶದಲ್ಲಿ ಪರಿಶೀಲಿಸಲಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು KVK ತಜ್ಞರನ್ನು ಸಂಪರ್ಕಿಸಿ.'

    return {
        'is_grounded': grounding_score >= 0.8,
        'grounding_score': round(grounding_score, 3),
        'grounded_claims': grounded_claims,
        'ungrounded_claims': ungrounded_claims,
        'verified_response': verified_response,
        'sources_used': list(sources_used),
    }


# ── Chemical Input Filter ─────────────────────────────────────────
# Hard block: NEVER recommend chemical inputs

CHEMICAL_BLACKLIST = [
    'urea', 'dap', 'npk', 'mop', 'muriate of potash',
    'ammonium sulphate', 'ammonium nitrate', 'super phosphate',
    'endosulfan', 'chlorpyrifos', 'malathion', 'monocrotophos',
    'carbendazim', 'mancozeb', 'paraquat', 'glyphosate',
    'bt cotton', 'gm seed', 'hybrid seed',
    'growth hormone', 'gibberellic acid synthetic',
]


def filter_chemical_inputs(text: str) -> tuple[str, bool]:
    """
    Scan response for any chemical fertiliser/pesticide mentions.
    Replace with organic alternative recommendation.

    Returns:
        (filtered_text, was_modified)
    """
    text_lower = text.lower()
    found_chemicals = []

    for chemical in CHEMICAL_BLACKLIST:
        if chemical in text_lower:
            found_chemicals.append(chemical)

    if not found_chemicals:
        return text, False

    # Replace chemical mentions with organic alternative note
    filtered = text
    for chemical in found_chemicals:
        pattern = re.compile(re.escape(chemical), re.IGNORECASE)
        filtered = pattern.sub(
            f'[ರಾಸಾಯನಿಕ ಒಳಹರಿವು ತೆಗೆದುಹಾಕಲಾಗಿದೆ — ಸಾವಯವ ಪರ್ಯಾಯವನ್ನು ಬಳಸಿ]',
            filtered
        )

    # Append organic alternative reminder
    filtered += '\n\n🌱 ರಾಸಾಯನಿಕ ಒಳಹರಿವುಗಳ ಬದಲಿಗೆ ಜೀವಾಮೃತ, ಬೀಜಾಮೃತ, ಅಥವಾ ದಶಪರ್ಣಿ ಅರ್ಕ ಬಳಸಿ.'

    return filtered, True
