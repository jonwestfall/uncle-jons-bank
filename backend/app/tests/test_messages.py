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
from app.models import Permission, UserPermissionLink, User, ChildUserLink
from app.crud import ensure_permissions_exist
from app.acl import ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, PERM_SEND_MESSAGE


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


def test_basic_messaging_flow():
    async def run():
        TestSession = await _setup_test_db()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Register admin and parent
            resp = await client.post(
                "/register",
                json={"name": "Admin", "email": "admin@example.com", "password": "pass"},
            )
            assert resp.status_code == 200
            admin_id = resp.json()["id"]
            resp = await client.post(
                "/register",
                json={"name": "Parent", "email": "parent@example.com", "password": "pass"},
            )
            assert resp.status_code == 200
            parent_id = resp.json()["id"]

            # Promote first user to admin and give parent default permissions
            async with TestSession() as session:
                admin = await session.get(User, admin_id)
                admin.role = "admin"
                for perm_name in ROLE_DEFAULT_PERMISSIONS["parent"]:
                    result = await session.execute(
                        select(Permission).where(Permission.name == perm_name)
                    )
                    perm = result.scalar_one()
                    session.add(UserPermissionLink(user_id=parent_id, permission_id=perm.id))
                await session.commit()

            # Login users
            resp = await client.post(
                "/login", json={"email": "admin@example.com", "password": "pass"}
            )
            admin_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
            resp = await client.post(
                "/login", json={"email": "parent@example.com", "password": "pass"}
            )
            parent_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Parent creates child
            resp = await client.post(
                "/children/",
                headers=parent_headers,
                json={"first_name": "Kid", "access_code": "KID"},
            )
            assert resp.status_code == 200
            child_id = resp.json()["id"]

            # Child login
            resp = await client.post(
                "/children/login", json={"access_code": "KID"}
            )
            assert resp.status_code == 200
            child_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Child can list linked parents
            resp = await client.get("/children/me/parents", headers=child_headers)
            assert resp.status_code == 200
            assert len(resp.json()) == 1
            assert resp.json()[0]["user_id"] == parent_id

            # Parent sends message to child
            resp = await client.post(
                "/messages/",
                headers=parent_headers,
                json={
                    "subject": "Hello",
                    "body": "<p>Hi Kid</p>",
                    "recipient_child_id": child_id,
                },
            )
            assert resp.status_code == 200
            msg_id = resp.json()["id"]

            # Child sees message in inbox
            resp = await client.get("/messages/inbox", headers=child_headers)
            assert resp.status_code == 200
            assert len(resp.json()) == 1
            assert resp.json()[0]["subject"] == "Hello"

            # Child replies to parent
            resp = await client.post(
                "/messages/",
                headers=child_headers,
                json={
                    "subject": "Re",
                    "body": "<p>Hi Parent</p>",
                    "recipient_user_id": parent_id,
                },
            )
            assert resp.status_code == 200

            # Parent inbox now has one message
            resp = await client.get("/messages/inbox", headers=parent_headers)
            assert len(resp.json()) == 1

            # Admin broadcasts to all
            resp = await client.post(
                "/messages/broadcast",
                headers=admin_headers,
                json={"subject": "Note", "body": "<p>System</p>", "target": "all"},
            )
            assert resp.status_code == 200
            assert resp.json()["count"] >= 2

            # Inbox counts updated
            resp = await client.get("/messages/inbox", headers=child_headers)
            assert len(resp.json()) == 2
            resp = await client.get("/messages/inbox", headers=parent_headers)
            assert len(resp.json()) == 2

            # Admin can view all messages
            resp = await client.get("/messages/all", headers=admin_headers)
            assert resp.status_code == 200
            assert len(resp.json()) >= 4

            # Remove parent's messaging permission at user level
            async with TestSession() as session:
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
                    "subject": "Denied",
                    "body": "<p>No send</p>",
                    "recipient_child_id": child_id,
                },
            )
            assert resp.status_code == 403

            # Create second parent and link to child
            resp = await client.post(
                "/register",
                json={"name": "Parent2", "email": "parent2@example.com", "password": "pass"},
            )
            assert resp.status_code == 200
            parent2_id = resp.json()["id"]

            async with TestSession() as session:
                for perm_name in ROLE_DEFAULT_PERMISSIONS["parent"]:
                    result = await session.execute(
                        select(Permission).where(Permission.name == perm_name)
                    )
                    perm_obj = result.scalar_one()
                    session.add(
                        UserPermissionLink(user_id=parent2_id, permission_id=perm_obj.id)
                    )
                session.add(
                    ChildUserLink(
                        user_id=parent2_id,
                        child_id=child_id,
                        permissions=ROLE_DEFAULT_PERMISSIONS["parent"],
                        is_owner=False,
                    )
                )
                await session.commit()

            resp = await client.post(
                "/login", json={"email": "parent2@example.com", "password": "pass"}
            )
            parent2_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Second parent can send message initially
            resp = await client.post(
                "/messages/",
                headers=parent2_headers,
                json={
                    "subject": "Hello2",
                    "body": "<p>Hi again</p>",
                    "recipient_child_id": child_id,
                },
            )
            assert resp.status_code == 200

            # Remove messaging permission from second parent's link
            async with TestSession() as session:
                link = await session.get(ChildUserLink, (parent2_id, child_id))
                link.permissions = [
                    p for p in link.permissions if p != PERM_SEND_MESSAGE
                ]
                session.add(link)
                await session.commit()

            resp = await client.post(
                "/messages/",
                headers=parent2_headers,
                json={
                    "subject": "Blocked",
                    "body": "<p>No link perm</p>",
                    "recipient_child_id": child_id,
                },
            )
            assert resp.status_code == 403

    asyncio.run(run())
