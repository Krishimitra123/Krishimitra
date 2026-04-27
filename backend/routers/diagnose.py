from fastapi import APIRouter, HTTPException
from models.schemas import DiagnosisRequest, DiagnosisFinding
from modules import m4_diagnosis

router = APIRouter(prefix='/api/diagnose', tags=['diagnose'])

@router.post('', response_model=DiagnosisFinding)
async def diagnose_endpoint(request: DiagnosisRequest):
    try:
        finding = await m4_diagnosis.diagnose_image(request)
        return finding
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
