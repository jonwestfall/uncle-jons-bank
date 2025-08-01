from typing import List
import asyncio

from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.database import get_session
from app.models import User, Permission, UserPermissionLink
from app.auth import get_password_hash
from app.crud import ensure_permissions_exist
from app.acl import ALL_PERMISSIONS


async def run_all_tests() -> dict:
    """Run integration tests against the API and return a summary."""
    results: List[str] = []
    success = True

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    async with TestSession() as session:
        await ensure_permissions_exist(session, ALL_PERMISSIONS)
        admin = User(
            name="Test Admin",
            email="admin@example.com",
            password_hash=get_password_hash("adminpass"),
            role="admin",
        )
        session.add(admin)
        await session.commit()

    async def override_get_session() -> AsyncSession:
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        try:
            resp = await client.post(
                "/login",
                json={"email": "admin@example.com", "password": "adminpass"},
            )
            assert resp.status_code == 200
            admin_token = resp.json()["access_token"]
            admin_headers = {"Authorization": f"Bearer {admin_token}"}
            results.append("Admin login successful")
        except AssertionError:
            results.append("Admin login failed")
            return {"success": False, "details": results}

        async def create_parent(name: str, email: str) -> tuple[int, str, dict]:
            resp = await client.post(
                "/register",
                json={"name": name, "email": email, "password": "parentpass"},
            )
            assert resp.status_code == 200
            uid = resp.json()["id"]
            perms = [
                "add_transaction",
                "view_transactions",
                "deposit",
                "debit",
                "add_child",
                "remove_child",
                "freeze_child",
            ]
            async with TestSession() as session:
                for name in perms:
                    result = await session.execute(
                        select(Permission).where(Permission.name == name)
                    )
                    perm = result.scalar_one()
                    link = UserPermissionLink(user_id=uid, permission_id=perm.id)
                    session.add(link)
                await session.commit()
            resp = await client.post(
                "/login",
                json={"email": email, "password": "parentpass"},
            )
            token = resp.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            me = await client.get("/users/me", headers=headers)
            uid = me.json()["id"]
            return uid, token, headers

        try:
            p1_id, _, p1_headers = await create_parent("Parent One", "parent1@example.com")
            p2_id, _, p2_headers = await create_parent("Parent Two", "parent2@example.com")
            results.append("Parents created")
        except Exception as e:
            results.append(f"Parent creation failed: {e}")
            return {"success": False, "details": results}

        async def create_child(headers: dict, name: str, code: str) -> int:
            resp = await client.post(
                "/children/",
                headers=headers,
                json={"first_name": name, "access_code": code},
            )
            assert resp.status_code == 200
            return resp.json()["id"]

        try:
            c1 = await create_child(p1_headers, "Child1A", "C1A")
            await create_child(p1_headers, "Child1B", "C1B")
            await create_child(p2_headers, "Child2A", "C2A")
            await create_child(p2_headers, "Child2B", "C2B")
            results.append("Children created")
        except Exception as e:
            results.append(f"Child creation failed: {e}")
            return {"success": False, "details": results}

        async def add_tx(headers: dict, uid: int, child: int, ttype: str, amt: float):
            resp = await client.post(
                "/transactions/",
                headers=headers,
                json={
                    "child_id": child,
                    "type": ttype,
                    "amount": amt,
                    "initiated_by": "parent",
                    "initiator_id": uid,
                },
            )
            assert resp.status_code == 200

        try:
            for _ in range(3):
                await add_tx(p1_headers, p1_id, c1, "credit", 10)
            for _ in range(2):
                await add_tx(p1_headers, p1_id, c1, "debit", 5)
            results.append("Transactions created")
        except Exception as e:
            results.append(f"Transaction creation failed: {e}")
            return {"success": False, "details": results}

        try:
            ledger = await client.get(f"/transactions/child/{c1}", headers=p1_headers)
            assert ledger.status_code == 200
            data = ledger.json()
            if data["balance"] != 20:
                raise AssertionError("Balance mismatch")
            if len(data["transactions"]) != 5:
                raise AssertionError("Transaction count mismatch")
            results.append("Ledger verified")
        except Exception as e:
            results.append(f"Ledger verification failed: {e}")
            return {"success": False, "details": results}

        try:
            resp = await client.get("/admin/users", headers=admin_headers)
            assert resp.status_code == 200
            if len(resp.json()) != 3:
                raise AssertionError("Unexpected user count")
            resp = await client.get("/admin/children", headers=admin_headers)
            assert resp.status_code == 200
            if len(resp.json()) != 4:
                raise AssertionError("Unexpected child count")
            resp = await client.get("/admin/transactions", headers=admin_headers)
            assert resp.status_code == 200
            if len(resp.json()) < 5:
                raise AssertionError("Unexpected transaction count")
            results.append("Admin endpoints verified")
        except Exception as e:
            results.append(f"Admin endpoint test failed: {e}")
            return {"success": False, "details": results}

    return {"success": success, "details": results}


if __name__ == "__main__":
    print(asyncio.run(run_all_tests()))
