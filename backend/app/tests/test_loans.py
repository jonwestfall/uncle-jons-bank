import asyncio
import pathlib
import sys

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select

sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.main import app
from app.database import get_session
from app.models import Permission, UserPermissionLink, User, ChildUserLink
from app.auth import get_password_hash
from app.crud import ensure_permissions_exist
from app.acl import ROLE_DEFAULT_PERMISSIONS, ALL_PERMISSIONS, PERM_OFFER_LOAN, PERM_MANAGE_LOAN


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


def test_loan_flow():
    async def run():
        TestSession = await _setup_test_db()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/login", json={"email": "admin@example.com", "password": "adminpass"}
            )
            assert resp.status_code == 200
            admin_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Register parent1 and parent2
            resp = await client.post(
                "/register",
                json={"name": "Parent1", "email": "p1@example.com", "password": "pass"},
            )
            parent1_id = resp.json()["id"]
            resp = await client.post(
                "/register",
                json={"name": "Parent2", "email": "p2@example.com", "password": "pass"},
            )
            parent2_id = resp.json()["id"]

            # Grant default permissions to parent1 only
            async with TestSession() as session:
                for perm_name in ROLE_DEFAULT_PERMISSIONS["parent"]:
                    result = await session.execute(
                        select(Permission).where(Permission.name == perm_name)
                    )
                    perm = result.scalar_one()
                    session.add(UserPermissionLink(user_id=parent1_id, permission_id=perm.id))
                await session.commit()

            # Parent1 login
            resp = await client.post(
                "/login", json={"email": "p1@example.com", "password": "pass"}
            )
            parent1_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Parent2 login
            resp = await client.post(
                "/login", json={"email": "p2@example.com", "password": "pass"}
            )
            parent2_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Create child
            resp = await client.post(
                "/children/",
                headers=parent1_headers,
                json={"first_name": "Kid", "access_code": "KID"},
            )
            child_id = resp.json()["id"]

            # Link parent2 to child without loan permissions
            async with TestSession() as session:
                link = ChildUserLink(user_id=parent2_id, child_id=child_id, permissions=[])
                session.add(link)
                await session.commit()

            # Child login
            resp = await client.post("/children/login", json={"access_code": "KID"})
            child_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

            # Child requests first loan
            resp = await client.post(
                "/loans/",
                headers=child_headers,
                json={"child_id": child_id, "amount": 50, "purpose": "Bike"},
            )
            loan1_id = resp.json()["id"]

            # Parent2 tries to approve loan -> 403
            resp = await client.post(
                f"/loans/{loan1_id}/approve",
                headers=parent2_headers,
                json={"interest_rate": 0.01},
            )
            assert resp.status_code == 403

            # Parent1 approves loan with terms
            resp = await client.post(
                f"/loans/{loan1_id}/approve",
                headers=parent1_headers,
                json={"interest_rate": 0.01, "terms": "test terms"},
            )
            assert resp.status_code == 200
            assert resp.json()["terms"] == "test terms"

            # Child declines loan
            resp = await client.post(
                f"/loans/{loan1_id}/decline", headers=child_headers
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "declined"

            # Child requests second loan
            resp = await client.post(
                "/loans/",
                headers=child_headers,
                json={"child_id": child_id, "amount": 80, "purpose": "Book"},
            )
            loan2_id = resp.json()["id"]

            # Parent1 approves second loan
            await client.post(
                f"/loans/{loan2_id}/approve",
                headers=parent1_headers,
                json={"interest_rate": 0.01},
            )

            # Child accepts loan
            resp = await client.post(
                f"/loans/{loan2_id}/accept", headers=child_headers
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "active"
            assert resp.json()["principal_remaining"] == 80

            # Parent2 interest change attempt -> 403
            resp = await client.post(
                f"/loans/{loan2_id}/interest",
                headers=parent2_headers,
                json={"interest_rate": 0.02},
            )
            assert resp.status_code == 403

            # Parent1 changes interest rate
            resp = await client.post(
                f"/loans/{loan2_id}/interest",
                headers=parent1_headers,
                json={"interest_rate": 0.02},
            )
            assert resp.status_code == 200
            assert resp.json()["interest_rate"] == 0.02

            # Parent2 payment attempt -> 403
            resp = await client.post(
                f"/loans/{loan2_id}/payment",
                headers=parent2_headers,
                json={"amount": 10},
            )
            assert resp.status_code == 403

            # Parent1 records payment
            resp = await client.post(
                f"/loans/{loan2_id}/payment",
                headers=parent1_headers,
                json={"amount": 20},
            )
            assert resp.status_code == 200
            assert resp.json()["principal_remaining"] == 60

            # Parent2 close attempt -> 403
            resp = await client.post(
                f"/loans/{loan2_id}/close", headers=parent2_headers
            )
            assert resp.status_code == 403

            # Parent1 closes loan
            resp = await client.post(
                f"/loans/{loan2_id}/close", headers=parent1_headers
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "closed"

    asyncio.run(run())
