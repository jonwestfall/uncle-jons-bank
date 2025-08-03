"""Tests for certificate of deposit endpoint flows."""

import asyncio
import pathlib
import sys

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select

# Allow importing the app package
sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.main import app
from app.database import get_session
from app.models import Permission, UserPermissionLink, User
from app.auth import get_password_hash
from app.crud import ensure_permissions_exist
from app.acl import ROLE_DEFAULT_PERMISSIONS, ALL_PERMISSIONS


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
        session.add(admin)
        await session.commit()

    return TestSession


def test_cd_endpoints():
    async def run():
        TestSession = await _setup_test_db()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Admin login
            resp = await client.post(
                "/login", json={"email": "admin@example.com", "password": "adminpass"}
            )
            assert resp.status_code == 200
            admin_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Register parent
            resp = await client.post(
                "/register",
                json={"name": "Parent", "email": "parent@example.com", "password": "pass"},
            )
            assert resp.status_code == 200
            parent_id = resp.json()["id"]

            # Grant default permissions to parent
            async with TestSession() as session:
                for perm_name in ROLE_DEFAULT_PERMISSIONS["parent"]:
                    result = await session.execute(
                        select(Permission).where(Permission.name == perm_name)
                    )
                    perm = result.scalar_one()
                    session.add(
                        UserPermissionLink(user_id=parent_id, permission_id=perm.id)
                    )
                await session.commit()

            # Parent login
            resp = await client.post(
                "/login", json={"email": "parent@example.com", "password": "pass"}
            )
            assert resp.status_code == 200
            parent_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Create child
            resp = await client.post(
                "/children/",
                headers=parent_headers,
                json={"first_name": "Kid", "access_code": "KID"},
            )
            assert resp.status_code == 200
            child_id = resp.json()["id"]

            # Child login
            resp = await client.post("/children/login", json={"access_code": "KID"})
            assert resp.status_code == 200
            child_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Fund child account
            resp = await client.post(
                "/transactions/",
                headers=parent_headers,
                json={
                    "child_id": child_id,
                    "type": "credit",
                    "amount": 100,
                    "initiated_by": "parent",
                    "initiator_id": parent_id,
                },
            )
            assert resp.status_code == 200

            # Parent offers a CD
            resp = await client.post(
                "/cds/",
                headers=parent_headers,
                json={
                    "child_id": child_id,
                    "amount": 50,
                    "interest_rate": 0.1,
                    "term_days": 0,
                },
            )
            assert resp.status_code == 200
            cd_id = resp.json()["id"]
            assert resp.json()["status"] == "offered"

            # Child accepts CD, balance debited
            resp = await client.post(f"/cds/{cd_id}/accept", headers=child_headers)
            assert resp.status_code == 200
            assert resp.json()["status"] == "accepted"
            resp = await client.get(
                f"/transactions/child/{child_id}", headers=child_headers
            )
            assert resp.status_code == 200
            assert resp.json()["balance"] == 50

            # Insufficient funds on acceptance
            resp = await client.post(
                "/cds/",
                headers=parent_headers,
                json={
                    "child_id": child_id,
                    "amount": 60,
                    "interest_rate": 0.1,
                    "term_days": 0,
                },
            )
            cd2_id = resp.json()["id"]
            resp = await client.post(
                f"/cds/{cd2_id}/accept", headers=child_headers
            )
            assert resp.status_code == 400
            assert resp.json()["detail"] == "Insufficient funds"

            # Child rejects a CD
            resp = await client.post(
                "/cds/",
                headers=parent_headers,
                json={
                    "child_id": child_id,
                    "amount": 10,
                    "interest_rate": 0.1,
                    "term_days": 0,
                },
            )
            cd3_id = resp.json()["id"]
            resp = await client.post(
                f"/cds/{cd3_id}/reject", headers=child_headers
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "rejected"
            resp = await client.get(
                f"/transactions/child/{child_id}", headers=child_headers
            )
            assert resp.status_code == 200
            assert resp.json()["balance"] == 50

            # Admin redeems matured CD
            resp = await client.post(f"/cds/{cd_id}/redeem", headers=admin_headers)
            assert resp.status_code == 200
            assert resp.json()["status"] == "redeemed"
            resp = await client.get(
                f"/transactions/child/{child_id}", headers=parent_headers
            )
            assert resp.status_code == 200
            assert resp.json()["balance"] == 105

            # Early redemption by child with penalty
            resp = await client.post(
                "/cds/",
                headers=parent_headers,
                json={
                    "child_id": child_id,
                    "amount": 40,
                    "interest_rate": 0.1,
                    "term_days": 10,
                },
            )
            cd4_id = resp.json()["id"]
            resp = await client.post(f"/cds/{cd4_id}/accept", headers=child_headers)
            assert resp.status_code == 200
            resp = await client.get(
                f"/transactions/child/{child_id}", headers=parent_headers
            )
            assert resp.json()["balance"] == 65

            resp = await client.post(
                f"/cds/{cd4_id}/redeem-early", headers=child_headers
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "redeemed"
            resp = await client.get(
                f"/transactions/child/{child_id}", headers=parent_headers
            )
            assert resp.status_code == 200
            assert resp.json()["balance"] == 101

    asyncio.run(run())
