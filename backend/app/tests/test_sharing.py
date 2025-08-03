import asyncio
import pathlib
import sys

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select

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


def test_share_and_unshare():
    async def run():
        TestSession = await _setup_test_db()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/register",
                json={"name": "Parent1", "email": "p1@example.com", "password": "pass"},
            )
            p1_id = resp.json()["id"]
            resp = await client.post(
                "/register",
                json={"name": "Parent2", "email": "p2@example.com", "password": "pass"},
            )
            p2_id = resp.json()["id"]
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
            resp = await client.post(
                "/login", json={"email": "p1@example.com", "password": "pass"}
            )
            headers1 = {"Authorization": f"Bearer {resp.json()['access_token']}"}
            resp = await client.post(
                "/login", json={"email": "p2@example.com", "password": "pass"}
            )
            headers2 = {"Authorization": f"Bearer {resp.json()['access_token']}"}
            resp = await client.post(
                "/children/",
                headers=headers1,
                json={"first_name": "Kid", "access_code": "KID"},
            )
            child_id = resp.json()["id"]
            resp = await client.post(
                f"/children/{child_id}/sharecode",
                headers=headers1,
                json={"permissions": ["view_transactions", "deposit", "offer_cd"]},
            )
            code = resp.json()["code"]
            resp = await client.post(
                f"/children/sharecode/{code}", headers=headers2
            )
            assert resp.status_code == 200
            resp = await client.post(
                "/transactions/",
                headers=headers2,
                json={
                    "child_id": child_id,
                    "type": "credit",
                    "amount": 5,
                    "memo": None,
                    "initiated_by": "parent",
                    "initiator_id": 0,
                },
            )
            assert resp.status_code == 200
            # Shared parent can offer a CD
            resp = await client.post(
                "/cds/",
                headers=headers2,
                json={
                    "child_id": child_id,
                    "amount": 10,
                    "interest_rate": 0.1,
                    "term_days": 0,
                },
            )
            assert resp.status_code == 200
            resp = await client.get(
                f"/children/{child_id}/parents", headers=headers1
            )
            assert len(resp.json()) == 2
            resp = await client.delete(
                f"/children/{child_id}/parents/{p2_id}", headers=headers1
            )
            assert resp.status_code == 204
            resp = await client.post(
                "/transactions/",
                headers=headers2,
                json={
                    "child_id": child_id,
                    "type": "credit",
                    "amount": 5,
                    "memo": None,
                    "initiated_by": "parent",
                    "initiator_id": 0,
                },
            )
            assert resp.status_code in (403, 404)
            # Cannot offer CD after removal
            resp = await client.post(
                "/cds/",
                headers=headers2,
                json={
                    "child_id": child_id,
                    "amount": 10,
                    "interest_rate": 0.1,
                    "term_days": 0,
                },
            )
            assert resp.status_code in (403, 404)
    asyncio.run(run())
