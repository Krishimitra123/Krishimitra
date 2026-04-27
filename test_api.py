import asyncio
from dotenv import load_dotenv
load_dotenv('backend/.env')
from backend.routers import query
from backend.models.schemas import QueryRequest, UserContext

async def test():
    req = QueryRequest(text_query="How do I prepare Jeevamrutha?", user_context=UserContext())
    res = await query.query_endpoint(req)
    print("Res:", res)

asyncio.run(test())
