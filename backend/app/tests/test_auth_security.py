import asyncio
import pathlib
import sys
from datetime import timedelta

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

# Allow importing the app package
sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.acl import ALL_PERMISSIONS
from app.auth import create_access_token, get_password_hash
from app.crud import ensure_permissions_exist
from app.database import get_session
from app.main import app
from app.models import Account, Child, ChildUserLink, User


async def _setup_test_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    test_session = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_session():
        async with test_session() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    async with test_session() as session:
        await ensure_permissions_exist(session, ALL_PERMISSIONS)
        admin = User(
            name="Admin",
            email="admin@example.com",
            password_hash=get_password_hash("pass"),
            role="admin",
            status="active",
        )
        parent = User(
            name="Parent",
            email="parent@example.com",
            password_hash=get_password_hash("pass"),
            role="parent",
            status="active",
        )
        child = Child(first_name="Kid", access_code="KID")
        session.add(admin)
        session.add(parent)
        session.add(child)
        await session.flush()

        session.add(Account(child_id=child.id, balance=0.0))
        session.add(
            ChildUserLink(
                user_id=parent.id,
                child_id=child.id,
                permissions=ALL_PERMISSIONS,
                is_owner=True,
            )
        )
        await session.commit()

    return test_session, parent.id, child.id


def test_auth_token_expiry_and_revocation_rejection():
    async def run():
        _, parent_id, _ = await _setup_test_db()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            login = await client.post(
                "/login", json={"email": "parent@example.com", "password": "pass"}
            )
            assert login.status_code == 200
            access_token = login.json()["access_token"]
            refresh_token = login.json()["refresh_token"]

            expired = create_access_token(
                {"sub": f"user:{parent_id}"}, expires_delta=timedelta(seconds=-1)
            )
            expired_headers = {"Authorization": f"Bearer {expired}"}
            expired_me = await client.get("/users/me", headers=expired_headers)
            assert expired_me.status_code == 401

            active_headers = {"Authorization": f"Bearer {access_token}"}
            logout = await client.post(
                "/logout",
                headers=active_headers,
                json={"refresh_token": refresh_token},
            )
            assert logout.status_code == 204

            revoked_me = await client.get("/users/me", headers=active_headers)
            assert revoked_me.status_code == 401

    asyncio.run(run())


def test_role_and_permission_checks_are_enforced():
    async def run():
        _, _, child_id = await _setup_test_db()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            login = await client.post(
                "/login", json={"email": "parent@example.com", "password": "pass"}
            )
            assert login.status_code == 200
            headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

            # Parent (non-admin) cannot create users.
            denied_role = await client.post(
                "/users/",
                headers=headers,
                json={
                    "name": "New User",
                    "email": "new@example.com",
                    "password": "pass",
                },
            )
            assert denied_role.status_code == 403

            # Parent without user-level permission links cannot create transactions.
            denied_perm = await client.post(
                "/transactions/",
                headers=headers,
                json={
                    "child_id": child_id,
                    "type": "credit",
                    "amount": 10,
                    "memo": "test",
                    "initiated_by": "parent",
                    "initiator_id": 1,
                },
            )
            assert denied_perm.status_code == 403

    asyncio.run(run())


def test_refresh_rotation_and_revoked_refresh_rejection():
    async def run():
        await _setup_test_db()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            login = await client.post(
                "/login", json={"email": "parent@example.com", "password": "pass"}
            )
            assert login.status_code == 200
            original_access = login.json()["access_token"]
            original_refresh = login.json()["refresh_token"]

            refresh = await client.post(
                "/refresh", json={"refresh_token": original_refresh}
            )
            assert refresh.status_code == 200
            new_access = refresh.json()["access_token"]
            new_refresh = refresh.json()["refresh_token"]
            assert new_access != original_access
            assert new_refresh != original_refresh

            replay = await client.post(
                "/refresh", json={"refresh_token": original_refresh}
            )
            assert replay.status_code == 401

            me = await client.get(
                "/users/me", headers={"Authorization": f"Bearer {new_access}"}
            )
            assert me.status_code == 200

            logout = await client.post(
                "/logout",
                headers={"Authorization": f"Bearer {new_access}"},
                json={"refresh_token": new_refresh},
            )
            assert logout.status_code == 204

            revoked_refresh = await client.post(
                "/refresh", json={"refresh_token": new_refresh}
            )
            assert revoked_refresh.status_code == 401

    asyncio.run(run())
