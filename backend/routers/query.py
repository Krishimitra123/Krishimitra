from fastapi import APIRouter
from models.schemas import QueryRequest, QueryResponse, Intent
from modules import m1_voice, m2_nlp
import os

router = APIRouter(prefix='/api/query', tags=['query'])

@router.post('', response_model=QueryResponse)
async def query_endpoint(request: QueryRequest):
    transcript = None
    
    # 1. STT if audio
    if request.audio_base64:
        try:
            stt_res = await m1_voice.audio_to_transcript(request.audio_base64, os.environ.get('SARVAM_API_KEY'))
            transcript = stt_res['transcript']
        except Exception as e:
            if not request.text_query:
                return QueryResponse(
                    answer_text_kn="ಧ್ವನಿ ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ.",
                    error=str(e)
                )
                
    query_text = transcript or request.text_query or ""
    if not query_text and not request.image_base64:
        return QueryResponse(answer_text_kn="ದಯವಿಟ್ಟು ಪ್ರಶ್ನೆ ಕೇಳಿ.")
        
    # 2. NLP Phase 1 Gate
    nlp_result = m2_nlp.process(
        transcript=query_text,
        user_ctx=request.user_context,
        has_image=bool(request.image_base64)
    )
    
    print(f"[Query] Intent: {nlp_result.intent}, Entities: {nlp_result.entities}")
    
    # 3. Pipeline Stub Return
    if nlp_result.intent == Intent.COMING_SOON:
        answer = "ಈ ವಿಷಯ ಶೀಘ್ರದಲ್ಲೇ KrishiMitra ಗೆ ಸೇರಿಸಲಾಗುವುದು. ಪ್ರಸ್ತುತ ಮಣ್ಣಿನ ಫಲವತ್ತತೆ ಮತ್ತು ಜೈವಿಕ ಗೊಬ್ಬರ ತಯಾರಿಕೆಯ ಮಾಹಿತಿ ನೀಡಲು ಸಿದ್ಧರಾಗಿದ್ದೇವೆ."
    elif nlp_result.intent == Intent.OUT_OF_DOMAIN:
        answer = "ಕ್ಷಮಿಸಿ, ಇದು ಕೃಷಿಗೆ ಸಂಬಂಧಿಸಿದ ಪ್ರಶ್ನೆಯಲ್ಲ. ದಯವಿಟ್ಟು ಕೃಷಿ ಬಗ್ಗೆ ಕೇಳಿ."
    else:
        # Stub for Week 3
        answer = "ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿದೆ — Coming soon (M3 and M4 will handle this in Week 3)"
        
    return QueryResponse(
        transcript=query_text,
        answer_text_kn=answer,
        intent=nlp_result.intent,
        sources=[]
    )
