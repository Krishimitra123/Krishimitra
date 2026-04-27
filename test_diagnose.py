import asyncio
from dotenv import load_dotenv
load_dotenv('backend/.env')
from backend.routers import diagnose
from backend.models.schemas import DiagnosisRequest, UserContext

async def test():
    req = DiagnosisRequest(image_base64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", image_mime="image/png", user_context=UserContext())
    res = await diagnose.diagnose_endpoint(req)
    print("Res:", res)

asyncio.run(test())
