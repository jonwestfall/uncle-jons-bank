from fastapi import APIRouter

router = APIRouter(prefix="/tests", tags=["tests"])

@router.post("/run")
async def run_tests_route():
    from app.tests.api_tests import run_all_tests
    return await run_all_tests()
