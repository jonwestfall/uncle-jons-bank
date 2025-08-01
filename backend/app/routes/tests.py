from fastapi import APIRouter

router = APIRouter(prefix="/tests", tags=["tests"])

@router.post("/run")
async def run_tests_route(persist: bool = False):
    """Run integration tests. Set ``persist=true`` to use the live database."""
    from app.tests.api_tests import run_all_tests

    return await run_all_tests(persist=persist)
