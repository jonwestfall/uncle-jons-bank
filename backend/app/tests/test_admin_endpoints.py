"""Tests for admin endpoints including permissions, role updates, child/transaction CRUD, and promotions."""

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
from app.crud import ensure_permissions_exist
from app.acl import ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS


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


def test_admin_permission_assignment_and_role_update():
    async def run():
        TestSession = await _setup_test_db()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Register admin and regular user
            resp = await client.post(
                "/register",
                json={"name": "Admin", "email": "admin@example.com", "password": "pass"},
            )
            assert resp.status_code == 200
            admin_id = resp.json()["id"]
            resp = await client.post(
                "/register",
                json={"name": "User", "email": "user@example.com", "password": "pass"},
            )
            assert resp.status_code == 200
            user_id = resp.json()["id"]

            # Promote first user to admin and assign permissions to second user
            async with TestSession() as session:
                admin = await session.get(User, admin_id)
                admin.role = "admin"
                for perm_name in ROLE_DEFAULT_PERMISSIONS["parent"]:
                    result = await session.execute(
                        select(Permission).where(Permission.name == perm_name)
                    )
                    perm = result.scalar_one()
                    session.add(
                        UserPermissionLink(user_id=user_id, permission_id=perm.id)
                    )
                await session.commit()

            # Login admin
            resp = await client.post(
                "/login", json={"email": "admin@example.com", "password": "pass"}
            )
            assert resp.status_code == 200
            admin_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Assign a permission to the user
            resp = await client.post(
                f"/admin/users/{user_id}/permissions",
                headers=admin_headers,
                json={"permissions": ["deposit"]},
            )
            assert resp.status_code == 200
            assert any(p["name"] == "deposit" for p in resp.json())

            # Remove the permission
            resp = await client.request(
                "DELETE",
                f"/admin/users/{user_id}/permissions",
                headers=admin_headers,
                json={"permissions": ["deposit"]},
            )
            assert resp.status_code == 200
            assert all(p["name"] != "deposit" for p in resp.json())

            # Assign again then change role to admin
            resp = await client.post(
                f"/admin/users/{user_id}/permissions",
                headers=admin_headers,
                json={"permissions": ["deposit"]},
            )
            assert resp.status_code == 200

            resp = await client.put(
                f"/admin/users/{user_id}",
                headers=admin_headers,
                json={"role": "admin"},
            )
            assert resp.status_code == 200

            # Verify default admin permissions were applied
            async with TestSession() as session:
                result = await session.execute(
                    select(Permission.name)
                    .join(UserPermissionLink)
                    .where(UserPermissionLink.user_id == user_id)
                )
                perms = {row[0] for row in result.all()}
            assert perms == set(ALL_PERMISSIONS)

    asyncio.run(run())


def test_admin_child_transaction_crud_and_promotion():
    async def run():
        TestSession = await _setup_test_db()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Register admin and parent
            resp = await client.post(
                "/register",
                json={"name": "Admin", "email": "admin2@example.com", "password": "pass"},
            )
            assert resp.status_code == 200
            admin_id = resp.json()["id"]
            resp = await client.post(
                "/register",
                json={"name": "Parent", "email": "parent@example.com", "password": "pass"},
            )
            assert resp.status_code == 200
            parent_id = resp.json()["id"]

            async with TestSession() as session:
                # Promote admin
                admin = await session.get(User, admin_id)
                admin.role = "admin"
                # Give parent default permissions
                for perm_name in ROLE_DEFAULT_PERMISSIONS["parent"]:
                    result = await session.execute(
                        select(Permission).where(Permission.name == perm_name)
                    )
                    perm = result.scalar_one()
                    session.add(
                        UserPermissionLink(user_id=parent_id, permission_id=perm.id)
                    )
                await session.commit()

            # Login both users
            resp = await client.post(
                "/login", json={"email": "admin2@example.com", "password": "pass"}
            )
            admin_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
            resp = await client.post(
                "/login", json={"email": "parent@example.com", "password": "pass"}
            )
            parent_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Parent creates a child
            resp = await client.post(
                "/children/",
                headers=parent_headers,
                json={"first_name": "Kid", "access_code": "KID"},
            )
            assert resp.status_code == 200
            child_id = resp.json()["id"]

            # Admin list and get child
            resp = await client.get("/admin/children", headers=admin_headers)
            assert resp.status_code == 200
            assert any(c["id"] == child_id for c in resp.json())

            resp = await client.get(
                f"/admin/children/{child_id}", headers=admin_headers
            )
            assert resp.status_code == 200

            # Admin updates child
            resp = await client.put(
                f"/admin/children/{child_id}",
                headers=admin_headers,
                json={"first_name": "NewKid", "frozen": True},
            )
            assert resp.status_code == 200
            assert resp.json()["first_name"] == "NewKid"
            assert resp.json()["account_frozen"] is True

            # Parent creates a transaction
            resp = await client.post(
                "/transactions/",
                headers=parent_headers,
                json={
                    "child_id": child_id,
                    "type": "credit",
                    "amount": 10,
                    "initiated_by": "parent",
                    "initiator_id": parent_id,
                },
            )
            assert resp.status_code == 200

            # Apply a promotion
            resp = await client.post(
                "/admin/promotions",
                headers=admin_headers,
                json={"amount": 5, "is_percentage": False, "credit": True},
            )
            assert resp.status_code == 200
            assert resp.json()["accounts_updated"] == 1

            # Admin lists transactions and finds promotion
            resp = await client.get("/admin/transactions", headers=admin_headers)
            assert resp.status_code == 200
            txs = resp.json()
            promo_tx = next(t for t in txs if t["memo"] == "Promotion")
            tx_id = promo_tx["id"]

            # Admin gets transaction
            resp = await client.get(
                f"/admin/transactions/{tx_id}", headers=admin_headers
            )
            assert resp.status_code == 200

            # Admin updates transaction
            resp = await client.put(
                f"/admin/transactions/{tx_id}",
                headers=admin_headers,
                json={"memo": "Adjusted"},
            )
            assert resp.status_code == 200
            assert resp.json()["memo"] == "Adjusted"

            # Admin deletes transaction
            resp = await client.delete(
                f"/admin/transactions/{tx_id}", headers=admin_headers
            )
            assert resp.status_code == 204

            resp = await client.get(
                f"/admin/transactions/{tx_id}", headers=admin_headers
            )
            assert resp.status_code == 404

            # Admin deletes child
            resp = await client.delete(
                f"/admin/children/{child_id}", headers=admin_headers
            )
            assert resp.status_code == 204
            resp = await client.get(
                f"/admin/children/{child_id}", headers=admin_headers
            )
            assert resp.status_code == 404

    asyncio.run(run())
