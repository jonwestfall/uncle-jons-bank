"""Tests for transaction permissions and authorization."""

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
from app.models import Permission, UserPermissionLink, ChildUserLink
from app.crud import ensure_permissions_exist
from app.acl import (
    ROLE_DEFAULT_PERMISSIONS,
    ALL_PERMISSIONS,
    PERM_ADD_TRANSACTION,
    PERM_DELETE_TRANSACTION,
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


def test_transaction_permissions():
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

            # Grant permissions
            async with TestSession() as session:
                for perm_name in ROLE_DEFAULT_PERMISSIONS["parent"]:
                    result = await session.execute(
                        select(Permission).where(Permission.name == perm_name)
                    )
                    perm = result.scalar_one()
                    session.add(UserPermissionLink(user_id=p1_id, permission_id=perm.id))
                # Parent1 also gets delete permission explicitly
                result = await session.execute(
                    select(Permission).where(Permission.name == PERM_DELETE_TRANSACTION)
                )
                perm = result.scalar_one()
                session.add(UserPermissionLink(user_id=p1_id, permission_id=perm.id))
                # Parent2 only gets add_transaction
                result = await session.execute(
                    select(Permission).where(Permission.name == PERM_ADD_TRANSACTION)
                )
                perm = result.scalar_one()
                session.add(UserPermissionLink(user_id=p2_id, permission_id=perm.id))
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

            # Link Parent2 to the same child
            async with TestSession() as session:
                session.add(ChildUserLink(user_id=p2_id, child_id=child_id))
                await session.commit()

            # Parent1 creates a transaction
            resp = await client.post(
                "/transactions/",
                headers=p1_headers,
                json={
                    "child_id": child_id,
                    "type": "credit",
                    "amount": 50,
                    "initiated_by": "parent",
                    "initiator_id": p1_id,
                },
            )
            assert resp.status_code == 200
            tx_id = resp.json()["id"]

            # Unauthorized update attempt by Parent2
            resp = await client.put(
                f"/transactions/{tx_id}",
                headers=p2_headers,
                json={"memo": "bad"},
            )
            assert resp.status_code == 403

            # Authorized update by Parent1
            resp = await client.put(
                f"/transactions/{tx_id}",
                headers=p1_headers,
                json={"memo": "updated"},
            )
            assert resp.status_code == 200
            assert resp.json()["memo"] == "updated"

            # Unauthorized delete attempt by Parent2
            resp = await client.delete(f"/transactions/{tx_id}", headers=p2_headers)
            assert resp.status_code == 403

            # Authorized delete by Parent1
            resp = await client.delete(f"/transactions/{tx_id}", headers=p1_headers)
            assert resp.status_code == 204

            # Deposit permission check
            resp = await client.post(
                "/transactions/",
                headers=p2_headers,
                json={
                    "child_id": child_id,
                    "type": "credit",
                    "amount": 10,
                    "initiated_by": "parent",
                    "initiator_id": p2_id,
                },
            )
            assert resp.status_code == 403

            # Debit permission check
            resp = await client.post(
                "/transactions/",
                headers=p2_headers,
                json={
                    "child_id": child_id,
                    "type": "debit",
                    "amount": 5,
                    "initiated_by": "parent",
                    "initiator_id": p2_id,
                },
            )
            assert resp.status_code == 403

    asyncio.run(run())
