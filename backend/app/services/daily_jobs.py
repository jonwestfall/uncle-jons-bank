"""Daily maintenance job service.

This module owns the orchestrated set of daily jobs that were previously
embedded directly in ``app.main``.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from typing import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlmodel import select

from app.crud import (
    apply_overdraft_fee,
    apply_service_fee,
    get_all_accounts,
    get_settings,
    process_due_recurring_charges,
    process_loan_interest,
    recalc_interest,
    redeem_matured_cds,
)
from app.models import JobRun

logger = logging.getLogger(__name__)

PIPELINE_JOB_NAME = "daily_jobs_pipeline"


async def _create_job_run(db: AsyncSession, job_name: str) -> JobRun:
    run = JobRun(job_name=job_name, status="running")
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


async def _finalize_job_run(
    db: AsyncSession,
    run: JobRun,
    *,
    status: str,
    error: str | None = None,
) -> None:
    run.status = status
    run.error = (error or "")[:2000] or None
    run.finished_at = datetime.utcnow()
    db.add(run)
    await db.commit()


async def run_tracked_job(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    job_name: str,
    runner: Callable[[AsyncSession], Awaitable[None]],
) -> None:
    async with session_factory() as run_db:
        run = await _create_job_run(run_db, job_name)

    try:
        async with session_factory() as db:
            await runner(db)
        async with session_factory() as run_db:
            fresh_run = await run_db.get(JobRun, run.id)
            if fresh_run:
                await _finalize_job_run(run_db, fresh_run, status="success")
    except Exception as exc:
        async with session_factory() as run_db:
            fresh_run = await run_db.get(JobRun, run.id)
            if fresh_run:
                await _finalize_job_run(
                    run_db,
                    fresh_run,
                    status="error",
                    error=str(exc),
                )
        raise


async def has_successful_run_for_day(
    db: AsyncSession,
    *,
    job_name: str,
    day: date,
) -> bool:
    start = datetime.combine(day, time.min)
    end = start + timedelta(days=1)
    result = await db.execute(
        select(JobRun.id).where(
            JobRun.job_name == job_name,
            JobRun.status == "success",
            JobRun.started_at >= start,
            JobRun.started_at < end,
        )
    )
    return result.first() is not None


async def run_due_recurring_charges(db: AsyncSession) -> None:
    await process_due_recurring_charges(db)


async def run_account_interest_and_fees(db: AsyncSession) -> None:
    settings = await get_settings(db)
    accounts = await get_all_accounts(db)
    for account in accounts:
        await recalc_interest(db, account.child_id)

    accounts = await get_all_accounts(db)
    today = date.today()
    for account in accounts:
        await apply_service_fee(db, account, settings, today)
        await apply_overdraft_fee(db, account, settings, today)


async def run_loan_interest(db: AsyncSession) -> None:
    await process_loan_interest(db)


async def run_cd_redemptions(db: AsyncSession) -> None:
    await redeem_matured_cds(db)


async def run_daily_jobs_once(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    run_date: date | None = None,
    skip_if_completed: bool = True,
) -> bool:
    """Run the full daily pipeline once.

    Returns ``True`` when this call executed the pipeline, and ``False`` when a
    successful run already exists for ``run_date``.
    """

    target_day = run_date or datetime.utcnow().date()

    if skip_if_completed:
        async with session_factory() as db:
            already_ran = await has_successful_run_for_day(
                db,
                job_name=PIPELINE_JOB_NAME,
                day=target_day,
            )
        if already_ran:
            logger.info(
                "Daily pipeline already completed for %s",
                target_day.isoformat(),
            )
            return False

    async def _run_pipeline(_: AsyncSession) -> None:
        await run_tracked_job(
            session_factory,
            job_name="daily.recurring_charges",
            runner=run_due_recurring_charges,
        )
        await run_tracked_job(
            session_factory,
            job_name="daily.account_interest_and_fees",
            runner=run_account_interest_and_fees,
        )
        await run_tracked_job(
            session_factory,
            job_name="daily.loan_interest",
            runner=run_loan_interest,
        )
        await run_tracked_job(
            session_factory,
            job_name="daily.cd_redemptions",
            runner=run_cd_redemptions,
        )

    await run_tracked_job(
        session_factory,
        job_name=PIPELINE_JOB_NAME,
        runner=_run_pipeline,
    )
    return True
