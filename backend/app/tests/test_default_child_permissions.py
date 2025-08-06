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
from app.models import ChildUserLink, Permission, UserPermissionLink
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


def test_default_permissions_on_child_creation():
    async def run():
        TestSession = await _setup_test_db()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/register",
                json={"name": "Parent", "email": "p@example.com", "password": "pass"},
            )
            assert resp.status_code == 200
            parent_id = resp.json()["id"]

            # Grant default parent permissions
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

            # Login
            resp = await client.post(
                "/login", json={"email": "p@example.com", "password": "pass"}
            )
            assert resp.status_code == 200
            headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Create a child
            resp = await client.post(
                "/children/",
                headers=headers,
                json={"first_name": "Kid", "access_code": "KID"},
            )
            assert resp.status_code == 200
            child_id = resp.json()["id"]

            # Verify link has full permissions and ownership
            async with TestSession() as session:
                result = await session.execute(
                    select(ChildUserLink).where(
                        (ChildUserLink.child_id == child_id)
                        & (ChildUserLink.user_id == parent_id)
                    )
                )
                link = result.scalar_one()
                assert set(link.permissions) == set(ALL_PERMISSIONS)
                assert link.is_owner is True

    asyncio.run(run())
