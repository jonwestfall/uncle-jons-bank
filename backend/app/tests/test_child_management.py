"""Tests for child management endpoints."""

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
from app.models import Permission, UserPermissionLink
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

    return TestSession


def test_child_management_endpoints():
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

            # Grant default permissions to both parents
            async with TestSession() as session:
                for uid in (p1_id, p2_id):
                    for perm_name in ROLE_DEFAULT_PERMISSIONS["parent"]:
                        result = await session.execute(
                            select(Permission).where(Permission.name == perm_name)
                        )
                        perm = result.scalar_one()
                        session.add(
                            UserPermissionLink(user_id=uid, permission_id=perm.id)
                        )
                await session.commit()

            # Login
            resp = await client.post(
                "/login", json={"email": "p1@example.com", "password": "pass"}
            )
            assert resp.status_code == 200
            headers1 = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            resp = await client.post(
                "/login", json={"email": "p2@example.com", "password": "pass"}
            )
            assert resp.status_code == 200
            headers2 = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Create a child for parent1
            resp = await client.post(
                "/children/",
                headers=headers1,
                json={"first_name": "Kid", "access_code": "KID"},
            )
            assert resp.status_code == 200
            child_id = resp.json()["id"]

            # Change access code
            resp = await client.put(
                f"/children/{child_id}/access-code",
                headers=headers1,
                json={"access_code": "NEW"},
            )
            assert resp.status_code == 200

            # Old code should fail, new code should work
            resp = await client.post(
                "/children/login", json={"access_code": "KID"}
            )
            assert resp.status_code == 401
            resp = await client.post(
                "/children/login", json={"access_code": "NEW"}
            )
            assert resp.status_code == 200

            # Non-owner cannot change access code
            resp = await client.put(
                f"/children/{child_id}/access-code",
                headers=headers2,
                json={"access_code": "BAD"},
            )
            assert resp.status_code == 404

            # Non-owner cannot freeze
            resp = await client.post(
                f"/children/{child_id}/freeze", headers=headers2
            )
            assert resp.status_code == 404

            # Owner freezes the child
            resp = await client.post(
                f"/children/{child_id}/freeze", headers=headers1
            )
            assert resp.status_code == 200
            assert resp.json()["account_frozen"] is True

            # Frozen child cannot log in
            resp = await client.post(
                "/children/login", json={"access_code": "NEW"}
            )
            assert resp.status_code == 403

            # Owner unfreezes the child
            resp = await client.post(
                f"/children/{child_id}/unfreeze", headers=headers1
            )
            assert resp.status_code == 200
            assert resp.json()["account_frozen"] is False

            resp = await client.post(
                "/children/login", json={"access_code": "NEW"}
            )
            assert resp.status_code == 200

            # Update interest rate
            resp = await client.put(
                f"/children/{child_id}/interest-rate",
                headers=headers1,
                json={"interest_rate": 0.05},
            )
            assert resp.status_code == 200
            assert resp.json()["interest_rate"] == 0.05

            resp = await client.put(
                f"/children/{child_id}/interest-rate",
                headers=headers2,
                json={"interest_rate": 0.01},
            )
            assert resp.status_code == 404

            # Update penalty interest rate
            resp = await client.put(
                f"/children/{child_id}/penalty-interest-rate",
                headers=headers1,
                json={"penalty_interest_rate": 0.1},
            )
            assert resp.status_code == 200
            assert resp.json()["penalty_interest_rate"] == 0.1

            resp = await client.put(
                f"/children/{child_id}/penalty-interest-rate",
                headers=headers2,
                json={"penalty_interest_rate": 0.2},
            )
            assert resp.status_code == 404

            # Update CD penalty rate
            resp = await client.put(
                f"/children/{child_id}/cd-penalty-rate",
                headers=headers1,
                json={"cd_penalty_rate": 0.15},
            )
            assert resp.status_code == 200
            assert resp.json()["cd_penalty_rate"] == 0.15

            resp = await client.put(
                f"/children/{child_id}/cd-penalty-rate",
                headers=headers2,
                json={"cd_penalty_rate": 0.25},
            )
            assert resp.status_code == 404

    asyncio.run(run())
