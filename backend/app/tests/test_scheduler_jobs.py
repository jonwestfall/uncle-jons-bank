"""Tests for daily scheduler orchestration and run tracking."""

import asyncio
import pathlib
import sys

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select

sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.models import JobRun
from app.services.daily_jobs import PIPELINE_JOB_NAME, run_daily_jobs_once


def test_daily_pipeline_records_job_runs_and_deduplicates_per_day():
    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        Session = async_sessionmaker(engine, expire_on_commit=False)

        first_run = await run_daily_jobs_once(Session)
        assert first_run is True

        async with Session() as session:
            result = await session.execute(select(JobRun))
            runs = result.scalars().all()

        assert len(runs) == 5
        names = {run.job_name for run in runs}
        assert PIPELINE_JOB_NAME in names
        assert "daily.recurring_charges" in names
        assert "daily.account_interest_and_fees" in names
        assert "daily.loan_interest" in names
        assert "daily.cd_redemptions" in names
        assert all(run.status == "success" for run in runs)
        assert all(run.started_at is not None for run in runs)
        assert all(run.finished_at is not None for run in runs)

        second_run = await run_daily_jobs_once(Session)
        assert second_run is False

        async with Session() as session:
            result = await session.execute(
                select(JobRun).where(JobRun.job_name == PIPELINE_JOB_NAME)
            )
            pipeline_runs = result.scalars().all()

        assert len(pipeline_runs) == 1

    asyncio.run(run())
