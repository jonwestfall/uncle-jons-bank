"""Scheduler runner with DB-backed leader election."""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import socket
import uuid
from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.database import async_session, create_db_and_tables
from app.services.daily_jobs import run_daily_jobs_once

logger = logging.getLogger(__name__)

DEFAULT_LOCK_NAME = "daily_jobs_lock"


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        logger.warning("Invalid integer value for %s=%r; using %s", name, raw, default)
        return default


def build_owner_id() -> str:
    host = socket.gethostname()
    pid = os.getpid()
    suffix = uuid.uuid4().hex[:8]
    return f"{host}:{pid}:{suffix}"


async def try_acquire_scheduler_lock(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    lock_name: str,
    owner_id: str,
    ttl_seconds: int,
) -> bool:
    now = datetime.utcnow()
    locked_until = now + timedelta(seconds=ttl_seconds)

    async with session_factory() as db:
        result = await db.execute(
            text(
                """
                UPDATE scheduler_locks
                SET owner_id = :owner_id,
                    locked_until = :locked_until,
                    updated_at = :now
                WHERE name = :name
                  AND (locked_until < :now OR owner_id = :owner_id)
                """
            ),
            {
                "name": lock_name,
                "owner_id": owner_id,
                "locked_until": locked_until,
                "now": now,
            },
        )
        if (result.rowcount or 0) > 0:
            await db.commit()
            return True

        try:
            await db.execute(
                text(
                    """
                    INSERT INTO scheduler_locks (name, owner_id, locked_until, updated_at)
                    VALUES (:name, :owner_id, :locked_until, :now)
                    """
                ),
                {
                    "name": lock_name,
                    "owner_id": owner_id,
                    "locked_until": locked_until,
                    "now": now,
                },
            )
            await db.commit()
            return True
        except IntegrityError:
            await db.rollback()
            return False


class DailyScheduler:
    """Poll-based scheduler that executes daily jobs under a leader lock."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        *,
        lock_name: str,
        owner_id: str,
        poll_seconds: int,
        lock_ttl_seconds: int,
    ) -> None:
        self._session_factory = session_factory
        self._lock_name = lock_name
        self._owner_id = owner_id
        self._poll_seconds = poll_seconds
        self._lock_ttl_seconds = lock_ttl_seconds

    async def run_forever(self) -> None:
        logger.info(
            "Scheduler started owner=%s lock=%s poll_seconds=%s ttl_seconds=%s",
            self._owner_id,
            self._lock_name,
            self._poll_seconds,
            self._lock_ttl_seconds,
        )
        while True:
            try:
                is_leader = await try_acquire_scheduler_lock(
                    self._session_factory,
                    lock_name=self._lock_name,
                    owner_id=self._owner_id,
                    ttl_seconds=self._lock_ttl_seconds,
                )
                if is_leader:
                    ran = await run_daily_jobs_once(self._session_factory)
                    if ran:
                        logger.info("Daily scheduler pipeline completed")
            except Exception:
                logger.exception("Scheduler loop iteration failed")

            await asyncio.sleep(self._poll_seconds)


async def run_scheduler_once(
    *,
    force: bool = False,
    skip_lock: bool = False,
) -> bool:
    """Run one scheduler cycle, intended for external schedulers/cron."""

    await create_db_and_tables()
    owner_id = os.getenv("SCHEDULER_OWNER_ID", build_owner_id())
    lock_name = os.getenv("SCHEDULER_LOCK_NAME", DEFAULT_LOCK_NAME)
    lock_ttl_seconds = _int_env("SCHEDULER_LOCK_TTL_SECONDS", 600)

    if not skip_lock:
        is_leader = await try_acquire_scheduler_lock(
            async_session,
            lock_name=lock_name,
            owner_id=owner_id,
            ttl_seconds=lock_ttl_seconds,
        )
        if not is_leader:
            logger.info("Skipping run because lock '%s' is held by another scheduler", lock_name)
            return False

    return await run_daily_jobs_once(async_session, skip_if_completed=not force)


def start_scheduler_task() -> asyncio.Task | None:
    """Start background scheduler task when configured for in-process mode."""

    mode = os.getenv("SCHEDULER_MODE", "leader").strip().lower()
    if mode == "external":
        logger.info("SCHEDULER_MODE=external; in-process scheduler disabled")
        return None

    scheduler = DailyScheduler(
        async_session,
        lock_name=os.getenv("SCHEDULER_LOCK_NAME", DEFAULT_LOCK_NAME),
        owner_id=os.getenv("SCHEDULER_OWNER_ID", build_owner_id()),
        poll_seconds=_int_env("SCHEDULER_POLL_SECONDS", 60),
        lock_ttl_seconds=_int_env("SCHEDULER_LOCK_TTL_SECONDS", 600),
    )
    return asyncio.create_task(scheduler.run_forever())


async def _run_cli() -> None:
    parser = argparse.ArgumentParser(description="Run daily scheduler jobs")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Run even when the daily pipeline already succeeded for today",
    )
    parser.add_argument(
        "--skip-lock",
        action="store_true",
        help="Do not acquire scheduler lock before running",
    )
    args = parser.parse_args()

    ran = await run_scheduler_once(force=args.force, skip_lock=args.skip_lock)
    if ran:
        logger.info("Scheduler run completed")
    else:
        logger.info("No work was executed")


if __name__ == "__main__":
    logging.basicConfig(level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper()))
    asyncio.run(_run_cli())
