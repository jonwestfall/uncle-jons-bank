"""Tests for withdrawal request workflow."""

import asyncio
import pathlib
import sys

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select, delete

# Allow importing the app package
sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.main import app
from app.database import get_session
from app.models import Permission, UserPermissionLink, User
from app.crud import ensure_permissions_exist
from app.acl import (
    ROLE_DEFAULT_PERMISSIONS,
    ALL_PERMISSIONS,
    PERM_MANAGE_WITHDRAWALS,
)


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

    return TestSession


def test_withdrawal_requests_flow():
    async def run():
        TestSession = await _setup_test_db()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Register two parents
            resp = await client.post(
                "/register",
                json={"name": "Parent1", "email": "p1@example.com", "password": "pass"},
            )
            assert resp.status_code == 200
            p1_id = resp.json()["id"]
            resp = await client.post(
                "/register",
                json={"name": "Parent2", "email": "p2@example.com", "password": "pass"},
            )
            assert resp.status_code == 200
            p2_id = resp.json()["id"]

            # Grant full permissions to parent1 and partial to parent2
            async with TestSession() as session:
                p1 = await session.get(User, p1_id)
                p2 = await session.get(User, p2_id)
                p1.status = "active"
                p2.status = "active"
                await session.execute(
                    delete(UserPermissionLink).where(UserPermissionLink.user_id == p2_id)
                )
                for perm_name in ROLE_DEFAULT_PERMISSIONS["parent"]:
                    if perm_name == PERM_MANAGE_WITHDRAWALS:
                        continue
                    result = await session.execute(
                        select(Permission).where(Permission.name == perm_name)
                    )
                    perm = result.scalar_one()
                    session.add(
                        UserPermissionLink(user_id=p2_id, permission_id=perm.id)
                    )
                await session.commit()

            # Login both parents
            resp = await client.post(
                "/login", json={"email": "p1@example.com", "password": "pass"}
            )
            assert resp.status_code == 200
            p1_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            resp = await client.post(
                "/login", json={"email": "p2@example.com", "password": "pass"}
            )
            assert resp.status_code == 200
            p2_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Parent1 creates a child
            resp = await client.post(
                "/children/",
                headers=p1_headers,
                json={"first_name": "Kid", "access_code": "KID"},
            )
            assert resp.status_code == 200
            child_id = resp.json()["id"]

            # Parent1 deposits funds into child's account
            resp = await client.post(
                "/transactions/",
                headers=p1_headers,
                json={
                    "child_id": child_id,
                    "type": "credit",
                    "amount": 100,
                    "initiated_by": "parent",
                    "initiator_id": p1_id,
                },
            )
            assert resp.status_code == 200

            # Child logs in
            child_login = await client.post(
                "/children/login", json={"access_code": "KID"}
            )
            assert child_login.status_code == 200
            child_headers = {
                "Authorization": f"Bearer {child_login.json()['access_token']}"
            }

            # Child submits two withdrawal requests
            resp = await client.post(
                "/withdrawals/",
                headers=child_headers,
                json={"amount": 30, "memo": "Need money"},
            )
            assert resp.status_code == 200
            w1_id = resp.json()["id"]

            resp = await client.post(
                "/withdrawals/",
                headers=child_headers,
                json={"amount": 20, "memo": "More money"},
            )
            assert resp.status_code == 200
            w2_id = resp.json()["id"]

            # Parent2 lacks withdrawal management permission
            resp = await client.get("/withdrawals/", headers=p2_headers)
            assert resp.status_code == 403

            resp = await client.post(
                f"/withdrawals/{w1_id}/approve", headers=p2_headers
            )
            assert resp.status_code == 403

            resp = await client.post(
                f"/withdrawals/{w2_id}/deny", headers=p2_headers, json={"reason": "No"}
            )
            assert resp.status_code == 403

            # Parent1 lists pending requests
            resp = await client.get("/withdrawals/", headers=p1_headers)
            assert resp.status_code == 200
            pending_ids = {r["id"] for r in resp.json()}
            assert pending_ids == {w1_id, w2_id}

            # Parent1 approves first request
            resp = await client.post(
                f"/withdrawals/{w1_id}/approve", headers=p1_headers
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "approved"

            # Ledger should reflect the debit
            resp = await client.get(
                f"/transactions/child/{child_id}", headers=p1_headers
            )
            assert resp.status_code == 200
            ledger = resp.json()
            assert ledger["balance"] == 70
            tx_types = [(t["type"], t["amount"]) for t in ledger["transactions"]]
            assert ("credit", 100) in tx_types
            assert ("debit", 30) in tx_types

            # Parent1 denies second request
            resp = await client.post(
                f"/withdrawals/{w2_id}/deny",
                headers=p1_headers,
                json={"reason": "Too much"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "denied"
            assert data["denial_reason"] == "Too much"
            assert data["responded_at"] is not None

            # No pending requests remain
            resp = await client.get("/withdrawals/", headers=p1_headers)
            assert resp.status_code == 200
            assert resp.json() == []

    asyncio.run(run())
