"""Tests for viewing and updating application settings."""

import asyncio
import pathlib
import sys

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel

# Allow importing the app package
sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.main import app
from app.database import get_session
from app.models import User
from app.auth import get_password_hash
from app.crud import ensure_permissions_exist
from app.acl import ALL_PERMISSIONS


async def _setup_test_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_session():
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    async with TestSession() as session:
        await ensure_permissions_exist(session, ALL_PERMISSIONS)
        admin = User(
            name="Admin",
            email="admin@example.com",
            password_hash=get_password_hash("adminpass"),
            role="admin",
        )
        parent = User(
            name="Parent",
            email="parent@example.com",
            password_hash=get_password_hash("parentpass"),
            role="parent",
        )
        session.add(admin)
        session.add(parent)
        await session.commit()

    return TestSession


def test_settings_endpoints():
    async def run():
        TestSession = await _setup_test_db()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Initial settings read
            resp = await client.get("/settings/")
            assert resp.status_code == 200
            data = resp.json()
            assert data["site_name"] == "Uncle Jon's Bank"
            assert data["currency_symbol"] == "$"

            # Non-admin attempt to update settings
            resp = await client.post(
                "/login", json={"email": "parent@example.com", "password": "parentpass"}
            )
            assert resp.status_code == 200
            parent_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
            resp = await client.put(
                "/settings/",
                headers=parent_headers,
                json={"site_name": "Hacked"},
            )
            assert resp.status_code == 403

            # Admin updates settings
            resp = await client.post(
                "/login", json={"email": "admin@example.com", "password": "adminpass"}
            )
            assert resp.status_code == 200
            admin_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
            resp = await client.put(
                "/settings/",
                headers=admin_headers,
                json={"site_name": "My Bank", "currency_symbol": "€"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["site_name"] == "My Bank"
            assert data["currency_symbol"] == "€"

            # Updated values persist on subsequent read
            resp = await client.get("/settings/")
            assert resp.status_code == 200
            data = resp.json()
            assert data["site_name"] == "My Bank"
            assert data["currency_symbol"] == "€"

    asyncio.run(run())
