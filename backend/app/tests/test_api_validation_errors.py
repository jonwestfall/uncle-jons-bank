"""Negative-path tests for request validation and domain invariants."""

import asyncio
import pathlib
import sys

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.acl import ALL_PERMISSIONS
from app.auth import get_password_hash
from app.crud import ensure_permissions_exist
from app.database import get_session
from app.main import app
from app.models import User


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
            password_hash=get_password_hash("adminpass"),
            role="admin",
            status="active",
        )
        session.add(admin)
        await session.commit()

    return test_session


def _assert_4xx_with_detail(resp):
    assert 400 <= resp.status_code < 500
    body = resp.json()
    assert "detail" in body


def test_negative_path_validation_and_invariants():
    async def run():
        test_session = await _setup_test_db()
        transport = ASGITransport(app=app)

        async with AsyncClient(transport=transport, base_url="http://test") as client:
            register = await client.post(
                "/register",
                json={"name": "Parent", "email": "p@example.com", "password": "password123"},
            )
            assert register.status_code == 200
            parent_id = register.json()["id"]

            async with test_session() as session:
                parent = await session.get(User, parent_id)
                parent.status = "active"
                await session.commit()

            login = await client.post(
                "/login", json={"email": "p@example.com", "password": "password123"}
            )
            assert login.status_code == 200
            parent_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

            child_resp = await client.post(
                "/children/",
                headers=parent_headers,
                json={"first_name": "Kid", "access_code": "KID123"},
            )
            assert child_resp.status_code == 200
            child_id = child_resp.json()["id"]

            neg_tx = await client.post(
                "/transactions/",
                headers=parent_headers,
                json={
                    "child_id": child_id,
                    "type": "credit",
                    "amount": -10,
                    "initiated_by": "parent",
                    "initiator_id": parent_id,
                },
            )
            assert neg_tx.status_code == 422
            _assert_4xx_with_detail(neg_tx)

            zero_tx = await client.post(
                "/transactions/",
                headers=parent_headers,
                json={
                    "child_id": child_id,
                    "type": "credit",
                    "amount": 0,
                    "initiated_by": "parent",
                    "initiator_id": parent_id,
                },
            )
            assert zero_tx.status_code == 400
            assert zero_tx.json()["detail"] == "Transaction amount must be greater than zero"

            bad_enum_tx = await client.post(
                "/transactions/",
                headers=parent_headers,
                json={
                    "child_id": child_id,
                    "type": "bonus",
                    "amount": 10,
                    "initiated_by": "parent",
                    "initiator_id": parent_id,
                },
            )
            assert bad_enum_tx.status_code == 422
            _assert_4xx_with_detail(bad_enum_tx)

            child_login = await client.post("/children/login", json={"access_code": "KID123"})
            assert child_login.status_code == 200
            child_headers = {"Authorization": f"Bearer {child_login.json()['access_token']}"}

            loan_req = await client.post(
                "/loans/",
                headers=child_headers,
                json={"child_id": child_id, "amount": 100, "purpose": "Bike"},
            )
            assert loan_req.status_code == 200
            loan_id = loan_req.json()["id"]

            approve = await client.post(
                f"/loans/{loan_id}/approve",
                headers=parent_headers,
                json={"interest_rate": 0.01, "terms": "Monthly payment"},
            )
            assert approve.status_code == 200

            accept = await client.post(f"/loans/{loan_id}/accept", headers=child_headers)
            assert accept.status_code == 200

            overpay = await client.post(
                f"/loans/{loan_id}/payment",
                headers=parent_headers,
                json={"amount": 101},
            )
            assert overpay.status_code == 400
            assert overpay.json()["detail"] == "Payment amount cannot exceed principal remaining"

            bad_rate = await client.post(
                f"/loans/{loan_id}/interest",
                headers=parent_headers,
                json={"interest_rate": 1.5},
            )
            assert bad_rate.status_code == 422
            _assert_4xx_with_detail(bad_rate)

            bad_msg = await client.post(
                "/messages/",
                headers=parent_headers,
                json={
                    "subject": "   ",
                    "body": "hello",
                    "recipient_child_id": child_id,
                },
            )
            assert bad_msg.status_code == 422
            _assert_4xx_with_detail(bad_msg)

    asyncio.run(run())
