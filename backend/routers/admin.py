from fastapi import APIRouter

router = APIRouter(prefix='/api/admin', tags=['admin'])

@router.post('/ingest')
async def ingest_stub():
    return {"status": "ingest stub"}
