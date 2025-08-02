import os
import logging
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)

DATABASE_URL = (
    "sqlite+aiosqlite:///./uncle_jons_bank.db"  # swap with Postgres URL if needed
)


# Control SQL echo via environment variable and route output through logging
SQL_ECHO = os.getenv("SQL_ECHO", "false").lower() == "true"
if SQL_ECHO:
    logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

engine = create_async_engine(DATABASE_URL, echo=SQL_ECHO)

async_session = async_sessionmaker(engine, expire_on_commit=False)


async def create_db_and_tables() -> None:
    from .models import (
        User,
        Child,
        ChildUserLink,
        Account,
        Transaction,
        WithdrawalRequest,
        Permission,
        UserPermissionLink,
        Settings,
    )

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
