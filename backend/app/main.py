"""FastAPI application entry point.

This module wires together the API routers, configures middleware and
startup tasks, and exposes the ASGI application object used by the
server.  Adding comments throughout this file should make the overall
application flow easier for new developers to follow.
"""

import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from app.routes import (
    users,
    children,
    auth,
    transactions,
    withdrawals,
    admin,
    tests,
    cds,
    settings,
    recurring,
)
from app.database import create_db_and_tables, async_session
from app.crud import (
    recalc_interest,
    ensure_permissions_exist,
    process_due_recurring_charges,
    get_all_accounts,
    get_settings,
    apply_service_fee,
    apply_overdraft_fee,
)
from app.models import Child
from app.acl import ALL_PERMISSIONS
from sqlmodel import select
import asyncio
from datetime import date

# Basic logging configuration.  The log level can be controlled with an
# environment variable so deployments can adjust verbosity without code
# changes.
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL))
logger = logging.getLogger(__name__)

app = FastAPI(docs_url=None)


def custom_openapi():
    """Generate an OpenAPI schema that is aware of our `/api` proxy prefix."""

    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    # The reverse proxy serves the API under `/api`; tell Swagger about it.
    openapi_schema["servers"] = [{"url": "/api"}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    """Initialize the database and kick off background tasks."""

    await create_db_and_tables()
    async with async_session() as session:
        # Ensure any new permissions are inserted into the database on startup.
        await ensure_permissions_exist(session, ALL_PERMISSIONS)
    # Run the long‑lived interest calculation loop in the background.
    asyncio.create_task(daily_interest_task())


async def daily_interest_task():
    """Background coroutine that runs once per day to apply account updates."""

    logger.info("Starting daily interest task")
    while True:
        try:
            async with async_session() as session:
                # Process any recurring charges that are due.
                await process_due_recurring_charges(session)
                settings = await get_settings(session)
                accounts = await get_all_accounts(session)
                # Recalculate interest for every account.
                for account in accounts:
                    await recalc_interest(session, account.child_id)
                accounts = await get_all_accounts(session)
                today = date.today()
                # Apply monthly service fees and overdraft penalties.
                for account in accounts:
                    await apply_service_fee(session, account, settings, today)
                    await apply_overdraft_fee(session, account, settings, today)
                from app.crud import redeem_matured_cds

                # Finally, redeem any matured certificates of deposit.
                await redeem_matured_cds(session)
        except Exception as exc:
            logger.exception("Daily interest task failed: %s", exc)
        # Sleep for roughly one day before running again.
        await asyncio.sleep(60 * 60 * 24)


app.include_router(users.router)
app.include_router(children.router)
app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(withdrawals.router)
app.include_router(cds.router)
app.include_router(admin.router)
app.include_router(tests.router)
app.include_router(settings.router)
app.include_router(recurring.router)


@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    """Serve the interactive docs with the correct API prefix."""

    # The API is served behind a `/api` prefix by the reverse proxy. The default
    # FastAPI docs expect the OpenAPI schema at `/openapi.json`, which lives
    # outside that prefix and results in the Swagger UI failing to load.
    # Point the docs to `/api/openapi.json` so requests are routed correctly.
    return get_swagger_ui_html(openapi_url="/api/openapi.json", title="API Docs")


@app.get("/")
async def read_root():
    from app.crud import get_settings

    async with async_session() as session:
        s = await get_settings(session)
        name = s.site_name
    return {"message": f"Welcome to {name} API"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler that logs the stack trace once."""
    logger.exception("Unhandled error during request %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "code": "internal_server_error",
            "message": "An unexpected error occurred",
        },
    )
