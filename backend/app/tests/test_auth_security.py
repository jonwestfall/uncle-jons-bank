import asyncio
import importlib
import os
import pathlib
import sys
from datetime import timedelta

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, select, delete

# Ensure auth config exists before importing app modules.
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("JWT_ISSUER", "test-suite")
os.environ.setdefault("JWT_AUDIENCE", "test-audience")

# Allow importing the app package
sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.main import app
from app.database import get_session
from app.models import Child, ChildUserLink, Permission, User, UserPermissionLink
from app.crud import ensure_permissions_exist
from app.acl import ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, PERM_SEND_MESSAGE
from app.auth import create_access_token, create_refresh_token


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

    return test_session


async def _seed_user(
    test_session,
    *,
    email: str,
    role: str,
    status: str = "active",
) -> int:
    async with test_session() as session:
        user = User(name=email.split("@")[0], email=email, password_hash="noop", role=role, status=status)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user.id


def test_auth_settings_require_secret_key():
    import app.auth as auth

    old_value = os.environ.pop("SECRET_KEY", None)
    importlib.reload(auth)
    try:
        try:
            auth.validate_auth_settings()
            assert False, "Expected RuntimeError when SECRET_KEY is unset"
        except RuntimeError:
            pass
    finally:
        if old_value is not None:
            os.environ["SECRET_KEY"] = old_value
        importlib.reload(auth)


def test_expired_access_token_is_rejected():
    async def run():
        test_session = await _setup_test_db()
        user_id = await _seed_user(
            test_session,
            email="expired@example.com",
            role="parent",
            status="active",
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            token = create_access_token(
                subject=f"user:{user_id}", expires_delta=timedelta(seconds=1)
            )
            await asyncio.sleep(2)
            resp = await client.get(
                "/users/me", headers={"Authorization": f"Bearer {token}"}
            )
            assert resp.status_code == 401

    asyncio.run(run())


def test_role_and_permission_enforcement():
    async def run():
        test_session = await _setup_test_db()
        admin_id = await _seed_user(
            test_session,
            email="admin-auth@example.com",
            role="admin",
            status="active",
        )
        parent_id = await _seed_user(
            test_session,
            email="parent-auth@example.com",
            role="parent",
            status="active",
        )

        async with test_session() as session:
            child = Child(first_name="Kid", access_code="AUTHKID")
            session.add(child)
            await session.commit()
            await session.refresh(child)
            session.add(
                ChildUserLink(
                    user_id=parent_id,
                    child_id=child.id,
                    permissions=ROLE_DEFAULT_PERMISSIONS["parent"],
                    is_owner=True,
                )
            )
            await session.commit()
            child_id = child.id

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            admin_headers = {
                "Authorization": f"Bearer {create_access_token(subject=f'user:{admin_id}') }"
            }
            parent_headers = {
                "Authorization": f"Bearer {create_access_token(subject=f'user:{parent_id}') }"
            }

            # Role check: non-admin cannot access admin-only route.
            resp = await client.get("/admin/users", headers=parent_headers)
            assert resp.status_code == 403
            resp = await client.get("/admin/users", headers=admin_headers)
            assert resp.status_code == 200

            # Permission check: remove messaging permission and ensure it is blocked.
            async with test_session() as session:
                result = await session.execute(
                    select(Permission).where(Permission.name == PERM_SEND_MESSAGE)
                )
                perm = result.scalar_one()
                await session.execute(
                    delete(UserPermissionLink).where(
                        UserPermissionLink.user_id == parent_id,
                        UserPermissionLink.permission_id == perm.id,
                    )
                )
                await session.commit()

            resp = await client.post(
                "/messages/",
                headers=parent_headers,
                json={
                    "subject": "blocked",
                    "body": "<p>x</p>",
                    "recipient_child_id": child_id,
                },
            )
            assert resp.status_code == 403

    asyncio.run(run())


def test_refresh_rotation_and_revoked_rejection():
    async def run():
        test_session = await _setup_test_db()
        user_id = await _seed_user(
            test_session,
            email="refresh@example.com",
            role="parent",
            status="active",
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = create_access_token(subject=f"user:{user_id}")
            refresh_token = create_refresh_token(subject=f"user:{user_id}")

            refresh_resp = await client.post(
                "/refresh", json={"refresh_token": refresh_token}
            )
            assert refresh_resp.status_code == 200
            rotated_access = refresh_resp.json()["access_token"]
            rotated_refresh = refresh_resp.json()["refresh_token"]

            # Old refresh token was rotated and revoked.
            reused_resp = await client.post(
                "/refresh", json={"refresh_token": refresh_token}
            )
            assert reused_resp.status_code == 401

            # Logout should revoke both current access and refresh tokens.
            logout_resp = await client.post(
                "/logout",
                headers={"Authorization": f"Bearer {rotated_access}"},
                json={"refresh_token": rotated_refresh},
            )
            assert logout_resp.status_code == 200

            revoked_access = await client.get(
                "/users/me",
                headers={"Authorization": f"Bearer {rotated_access}"},
            )
            assert revoked_access.status_code == 401

            revoked_refresh = await client.post(
                "/refresh", json={"refresh_token": rotated_refresh}
            )
            assert revoked_refresh.status_code == 401

            # Original access token has never been revoked and remains usable.
            still_valid = await client.get(
                "/users/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            assert still_valid.status_code == 200

    asyncio.run(run())
