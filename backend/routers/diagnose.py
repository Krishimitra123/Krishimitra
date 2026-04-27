from fastapi import APIRouter

router = APIRouter(prefix='/api/diagnose', tags=['diagnose'])

@router.post('')
async def diagnose_stub():
    return {"status": "diagnose stub"}
