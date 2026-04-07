"""FastAPI application entry point.

This module wires together the API routers, configures middleware and
startup tasks, and exposes the ASGI application object used by the
server.  Adding comments throughout this file should make the overall
application flow easier for new developers to follow.
"""

import os
import logging
from urllib.parse import urlparse
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
    loans,
    messages,
    coupons,
    education,
    chores,
)
from app.database import create_db_and_tables, async_session
from app.crud import (
    ensure_permissions_exist,
)
from app.acl import ALL_PERMISSIONS
from app.auth import purge_expired_revoked_tokens
from app.services.scheduler import start_scheduler_task

# Basic logging configuration.  The log level can be controlled with an
# environment variable so deployments can adjust verbosity without code
# changes.
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL))
logger = logging.getLogger(__name__)

app = FastAPI(docs_url=None)


def _env_flag_enabled(name: str, default: bool = False) -> bool:
    """Parse common truthy env values for feature flags."""

    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _parse_allowed_origins(raw_origins: str) -> list[str]:
    """Parse comma-separated origins and drop empty entries."""

    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


def _validate_strict_origin(origin: str) -> bool:
    """Require explicit scheme, host, and port for strict environments."""

    parsed = urlparse(origin)
    return bool(parsed.scheme and parsed.hostname and parsed.port)


def _build_cors_config() -> dict:
    """Build CORS policy from environment with strict non-dev defaults."""

    env = os.getenv("ENV", "production").strip().lower()
    raw_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
    parsed_origins = _parse_allowed_origins(raw_origins)

    if env == "development":
        allow_origins = parsed_origins or ["*"]
    else:
        if any(origin == "*" for origin in parsed_origins):
            raise RuntimeError(
                "CORS_ALLOWED_ORIGINS cannot include '*' when ENV is not development."
            )

        invalid_origins = [
            origin for origin in parsed_origins if not _validate_strict_origin(origin)
        ]
        if invalid_origins:
            raise RuntimeError(
                "Invalid CORS_ALLOWED_ORIGINS entries for strict mode "
                f"(must include scheme, host, and port): {invalid_origins}"
            )
        allow_origins = parsed_origins

    return {
        "env": env,
        "allow_origins": allow_origins,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }


cors_config = _build_cors_config()
test_routes_enabled = _env_flag_enabled("ENABLE_TEST_ROUTES", default=False)


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
    allow_origins=cors_config["allow_origins"],
    allow_credentials=cors_config["allow_credentials"],
    allow_methods=cors_config["allow_methods"],
    allow_headers=cors_config["allow_headers"],
)


@app.on_event("startup")
async def on_startup():
    """Initialize the database and kick off background tasks."""

    logger.info(
        "CORS policy active: env=%s allow_origins=%s allow_credentials=%s allow_methods=%s allow_headers=%s",
        cors_config["env"],
        cors_config["allow_origins"],
        cors_config["allow_credentials"],
        cors_config["allow_methods"],
        cors_config["allow_headers"],
    )
    if test_routes_enabled:
        logger.warning(
            "ENABLE_TEST_ROUTES is enabled. Development-only /tests endpoints are available and should not be exposed in production."
        )

    await create_db_and_tables()
    async with async_session() as session:
        # Ensure any new permissions are inserted into the database on startup.
        await ensure_permissions_exist(session, ALL_PERMISSIONS)
        await purge_expired_revoked_tokens(session)
        from app.crud import ensure_education_content

        await ensure_education_content(session)
    # Start scheduler loop (or skip when configured for external scheduling).
    start_scheduler_task()


app.include_router(users.router)
app.include_router(children.router)
app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(withdrawals.router)
app.include_router(cds.router)
app.include_router(admin.router)
if test_routes_enabled:
    app.include_router(tests.router)
app.include_router(settings.router)
app.include_router(recurring.router)
app.include_router(loans.router)
app.include_router(messages.router)
app.include_router(coupons.router)
app.include_router(education.router)
app.include_router(chores.router)


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
