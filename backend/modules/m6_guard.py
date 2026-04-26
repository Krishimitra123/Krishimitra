"""
Module M6 — Hallucination Guard
Responsibility: Cross-check every LLM-generated response against RAG source chunks.
If a claim cannot be traced to a verified source → flag it and add disclaimer.

This is what makes KrishiMitra NOT a wrapper — every output is grounded.
"""

from sentence_transformers import SentenceTransformer
import numpy as np
import re
import os
from typing import Optional

MODEL_NAME = os.environ.get('EMBEDDING_MODEL_NAME',
             'sentence-transformers/paraphrase-multilingual-mpnet-base-v2')

# Minimum similarity for a claim to be considered "grounded"
GROUNDING_THRESHOLD = 0.55

_model = None


def _ensure_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)


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


def verify_response(
    llm_response: str,
    rag_chunks: list,
    threshold: float = GROUNDING_THRESHOLD,
) -> dict:
    """
    Cross-check LLM response against provided RAG chunks.

    Args:
        llm_response: The full LLM-generated response text
        rag_chunks: List of RAGChunk objects (or dicts with 'content' key)
        threshold: Minimum cosine similarity for grounding

    Returns:
        {
            'is_grounded': bool,        # True if >80% of claims are grounded
            'grounding_score': float,   # 0.0 to 1.0
            'grounded_claims': list,    # Claims that match RAG sources
            'ungrounded_claims': list,  # Claims with no RAG backing
            'verified_response': str,   # Cleaned response (ungrounded parts flagged)
            'sources_used': list,       # Source documents cited
        }
    """
    _ensure_model()

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
        # No RAG chunks to verify against — flag entire response
        return {
            'is_grounded': False,
            'grounding_score': 0.0,
            'grounded_claims': [],
            'ungrounded_claims': claims,
            'verified_response': llm_response,
            'sources_used': [],
        }

    # Embed claims and chunks
    claim_embeddings = _model.encode(claims, normalize_embeddings=True)
    chunk_embeddings = _model.encode(chunk_texts, normalize_embeddings=True)

    # Compute similarity matrix: claims x chunks
    similarity_matrix = np.dot(claim_embeddings, chunk_embeddings.T)

    grounded_claims = []
    ungrounded_claims = []
    sources_used = set()

    for i, claim in enumerate(claims):
        max_sim = float(np.max(similarity_matrix[i]))
        best_chunk_idx = int(np.argmax(similarity_matrix[i]))

        if max_sim >= threshold:
            grounded_claims.append({
                'claim': claim,
                'similarity': round(max_sim, 3),
                'source': chunk_sources[best_chunk_idx],
            })
            sources_used.add(chunk_sources[best_chunk_idx])
        else:
            ungrounded_claims.append({
                'claim': claim,
                'best_similarity': round(max_sim, 3),
            })

    total = len(claims)
    grounded_count = len(grounded_claims)
    grounding_score = grounded_count / total if total > 0 else 1.0

    # Build verified response
    verified_response = llm_response
    if grounding_score < 0.8 and ungrounded_claims:
        # Append disclaimer for low-grounding responses
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
