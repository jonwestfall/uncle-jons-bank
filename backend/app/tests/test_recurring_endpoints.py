"""Tests for recurring charge endpoints."""

import asyncio
import pathlib
import sys
from datetime import date, timedelta

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


def test_recurring_charge_endpoints():
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
                        session.add(UserPermissionLink(user_id=uid, permission_id=perm.id))
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

            # Create children
            resp = await client.post(
                "/children/",
                headers=headers1,
                json={"first_name": "Kid1", "access_code": "C1"},
            )
            assert resp.status_code == 200
            child1_id = resp.json()["id"]

            resp = await client.post(
                "/children/",
                headers=headers2,
                json={"first_name": "Kid2", "access_code": "C2"},
            )
            assert resp.status_code == 200
            child2_id = resp.json()["id"]

            # Add recurring charge for child1
            next_date = (date.today() + timedelta(days=1)).isoformat()
            resp = await client.post(
                f"/recurring/child/{child1_id}",
                headers=headers1,
                json={
                    "amount": 5,
                    "type": "debit",
                    "memo": "Allowance",
                    "interval_days": 7,
                    "next_run": next_date,
                },
            )
            assert resp.status_code == 200
            charge_id = resp.json()["id"]

            # Reject past next_run dates
            past_date = (date.today() - timedelta(days=1)).isoformat()
            resp = await client.post(
                f"/recurring/child/{child1_id}",
                headers=headers1,
                json={
                    "amount": 5,
                    "type": "debit",
                    "memo": "Past",
                    "interval_days": 7,
                    "next_run": past_date,
                },
            )
            assert resp.status_code == 400

            # Non-owner cannot add charge
            resp = await client.post(
                f"/recurring/child/{child1_id}",
                headers=headers2,
                json={
                    "amount": 5,
                    "type": "debit",
                    "memo": "Bad",
                    "interval_days": 7,
                    "next_run": next_date,
                },
            )
            assert resp.status_code == 404

            # Parent lists charges for their child
            resp = await client.get(f"/recurring/child/{child1_id}", headers=headers1)
            assert resp.status_code == 200
            assert len(resp.json()) == 1

            # Other parent cannot list
            resp = await client.get(f"/recurring/child/{child1_id}", headers=headers2)
            assert resp.status_code == 404

            # Child lists own charges
            resp = await client.post(
                "/children/login", json={"access_code": "C1"}
            )
            assert resp.status_code == 200
            child1_headers = {
                "Authorization": f"Bearer {resp.json()['access_token']}"
            }
            resp = await client.get("/recurring/mine", headers=child1_headers)
            assert resp.status_code == 200
            assert len(resp.json()) == 1

            # Child cannot list another child's charges
            resp = await client.post(
                "/children/login", json={"access_code": "C2"}
            )
            assert resp.status_code == 200
            child2_headers = {
                "Authorization": f"Bearer {resp.json()['access_token']}"
            }
            resp = await client.get(
                f"/recurring/child/{child1_id}", headers=child2_headers
            )
            assert resp.status_code == 403

            # Update recurring charge
            new_date = (date.today() + timedelta(days=2)).isoformat()
            resp = await client.put(
                f"/recurring/{charge_id}",
                headers=headers1,
                json={"memo": "Updated", "next_run": new_date},
            )
            assert resp.status_code == 200
            assert resp.json()["memo"] == "Updated"

            # Update with past next_run rejected
            resp = await client.put(
                f"/recurring/{charge_id}",
                headers=headers1,
                json={"next_run": past_date},
            )
            assert resp.status_code == 400

            # Non-owner cannot update
            resp = await client.put(
                f"/recurring/{charge_id}",
                headers=headers2,
                json={"memo": "Nope"},
            )
            assert resp.status_code == 404

            # Non-owner cannot delete
            resp = await client.delete(
                f"/recurring/{charge_id}", headers=headers2
            )
            assert resp.status_code == 404

            # Owner deletes charge
            resp = await client.delete(
                f"/recurring/{charge_id}", headers=headers1
            )
            assert resp.status_code == 204

            # Ensure charge removed
            resp = await client.get(f"/recurring/child/{child1_id}", headers=headers1)
            assert resp.status_code == 200
            assert resp.json() == []

    asyncio.run(run())
