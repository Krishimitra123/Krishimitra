from dataclasses import dataclass
from typing import Optional, List

@dataclass
class ConfidenceReport:
    score: int
    can_deliver: bool
    chemical_detected: bool
    block_reason: Optional[str]

def compute_confidence(skb_record: Optional[dict], rag_chunks: List[dict], kg_traversal: Optional[dict], llm_draft: str) -> ConfidenceReport:
    score = 0
    can_deliver = True
    chemical_detected = False
    block_reason = None
    
    # 1. Chemical Blocking (Absolute Priority)
    CHEMICALS = [
        'urea', 'dap', 'npk', 'ammonium', 'superphosphate', 'chlorpyrifos', 
        'imidacloprid', 'cypermethrin', 'endosulfan', 'glyphosate', 
        'carbofuran', 'monocrotophos', 'paraquat'
    ]
    
    llm_lower = llm_draft.lower()
    if any(chem in llm_lower for chem in CHEMICALS):
        return ConfidenceReport(
            score=0,
            can_deliver=False,
            chemical_detected=True,
            block_reason="Chemical input detected in response. Redirecting to KVK."
        )

    # 2. SKB Scoring
    skb_source = None
    if skb_record:
        if skb_record.get('confidence_level') == 'cross_validated':
            score += 50
        else:
            score += 25
        skb_source = skb_record.get('primary_source')
            
    # 3. RAG Scoring
    max_sim = 0.0
    for chunk in rag_chunks:
        sim = chunk.get('similarity', 0.0)
        if sim > max_sim:
            max_sim = sim
            
        # SKB/RAG Cross validation bonus
        if skb_source and chunk.get('source_doc') == skb_source:
            score += 10
            
    if max_sim > 0.80:
        score += 30
    elif max_sim > 0.70:
        score += 20
    elif max_sim > 0.60:
        score += 10
        
    # 4. KG Scoring
    if kg_traversal and kg_traversal.get('path_found'):
        score += 10
        
    # Cap score at 100
    score = min(score, 100)
    
    # 5. Delivery Rules
    if score < 50:
        can_deliver = False
        block_reason = "Confidence score below 50."
    elif score < 70 and not skb_record:
        can_deliver = False
        block_reason = "Confidence score below 70 without Structured Knowledge Base match."
        
    return ConfidenceReport(
        score=score,
        can_deliver=can_deliver,
        chemical_detected=False,
        block_reason=block_reason
    )
