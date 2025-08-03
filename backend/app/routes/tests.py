"""Development-only endpoints for running automated test suites."""

from fastapi import APIRouter, Depends
from app.models import User
from app.auth import require_role

router = APIRouter(prefix="/tests", tags=["tests"])


@router.post("/run")
async def run_tests_route(persist: bool = False):
    """Run integration tests. Set ``persist=true`` to use the live database."""
    from app.tests.api_tests import run_all_tests

    return await run_all_tests(persist=persist)


@router.post("/interest-test")
async def interest_test_route(persist: bool = False, days: int = 5):
    """Run interest calculation test.

    ``days`` controls how far from today the initial transaction is dated. A
    positive value backdates the starting transaction, while a negative value sets
    it in the future.
    """
    from app.tests.interest_tests import run_interest_test

    return await run_interest_test(persist=persist, days=days)


@router.post("/cd-issue")
async def cd_issue_route(
    persist: bool = False, days: int = 30, rate: float = 0.05
):
    """Create test users and issue a CD."""
    from app.tests.cd_tests import run_cd_issue_test

    return await run_cd_issue_test(persist=persist, days=days, rate=rate)


@router.post("/cd-redeem")
async def cd_redeem_route(
    cd_id: int,
    persist: bool = False,
    current_user: User = Depends(require_role("admin")),
):
    """Redeem a CD as if matured today. Admin only."""
    from app.tests.cd_tests import run_cd_redeem_test

    return await run_cd_redeem_test(cd_id=cd_id, persist=persist)
