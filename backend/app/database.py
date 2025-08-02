import os
import logging
from sqlmodel import SQLModel
from sqlalchemy import text
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

        # --- simple schema migration for existing installs ---
        # add new fee-related columns if they don't exist yet
        pragma = "PRAGMA table_info('{table}')"
        async def has_column(table: str, column: str) -> bool:
            result = await conn.execute(text(pragma.format(table=table)))
            cols = [row[1] for row in result.fetchall()]
            return column in cols

        # Settings table columns
        if not await has_column("settings", "service_fee_amount"):
            await conn.execute(
                text(
                    "ALTER TABLE settings ADD COLUMN service_fee_amount FLOAT DEFAULT 0"
                )
            )
        if not await has_column("settings", "service_fee_is_percentage"):
            await conn.execute(
                text(
                    "ALTER TABLE settings ADD COLUMN service_fee_is_percentage BOOLEAN DEFAULT 0"
                )
            )
        if not await has_column("settings", "overdraft_fee_amount"):
            await conn.execute(
                text(
                    "ALTER TABLE settings ADD COLUMN overdraft_fee_amount FLOAT DEFAULT 0"
                )
            )
        if not await has_column("settings", "overdraft_fee_is_percentage"):
            await conn.execute(
                text(
                    "ALTER TABLE settings ADD COLUMN overdraft_fee_is_percentage BOOLEAN DEFAULT 0"
                )
            )
        if not await has_column("settings", "overdraft_fee_daily"):
            await conn.execute(
                text(
                    "ALTER TABLE settings ADD COLUMN overdraft_fee_daily BOOLEAN DEFAULT 0"
                )
            )

        # Account table columns
        if not await has_column("account", "service_fee_last_charged"):
            await conn.execute(
                text(
                    "ALTER TABLE account ADD COLUMN service_fee_last_charged DATE"
                )
            )
        if not await has_column("account", "overdraft_fee_last_charged"):
            await conn.execute(
                text(
                    "ALTER TABLE account ADD COLUMN overdraft_fee_last_charged DATE"
                )
            )
        if not await has_column("account", "overdraft_fee_charged"):
            await conn.execute(
                text(
                    "ALTER TABLE account ADD COLUMN overdraft_fee_charged BOOLEAN DEFAULT 0"
                )
            )


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
