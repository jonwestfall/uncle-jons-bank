"""Database configuration and helper utilities.

This module configures the asynchronous SQLAlchemy engine and provides
session helpers along with a small migration routine to keep the SQLite
schema in sync.  Comments are added throughout to clarify the startup
sequence and purpose of each block.
"""

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
    """Create initial tables and apply simple schema migrations."""

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
        Message,
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
        if not await has_column("settings", "currency_symbol"):
            await conn.execute(
                text(
                    "ALTER TABLE settings ADD COLUMN currency_symbol VARCHAR DEFAULT '$'"
                )
            )

        # RecurringCharge table columns
        if not await has_column("recurringcharge", "type"):
            await conn.execute(
                text(
                    "ALTER TABLE recurringcharge ADD COLUMN type VARCHAR DEFAULT 'debit'"
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

        monetary_columns = {
            "account": {
                "balance": "NUMERIC(14,2)",
                "interest_rate": "NUMERIC(12,6)",
                "penalty_interest_rate": "NUMERIC(12,6)",
                "cd_penalty_rate": "NUMERIC(12,6)",
                "total_interest_earned": "NUMERIC(14,2)",
            },
            "transaction": {"amount": "NUMERIC(14,2)"},
            "withdrawalrequest": {"amount": "NUMERIC(14,2)"},
            "recurringcharge": {"amount": "NUMERIC(14,2)"},
            "certificatedeposit": {
                "amount": "NUMERIC(14,2)",
                "interest_rate": "NUMERIC(12,6)",
            },
            "loan": {
                "amount": "NUMERIC(14,2)",
                "interest_rate": "NUMERIC(12,6)",
                "principal_remaining": "NUMERIC(14,2)",
            },
            "loantransaction": {"amount": "NUMERIC(14,2)"},
            "chore": {"amount": "NUMERIC(14,2)"},
            "settings": {
                "default_interest_rate": "NUMERIC(12,6)",
                "default_penalty_interest_rate": "NUMERIC(12,6)",
                "default_cd_penalty_rate": "NUMERIC(12,6)",
                "service_fee_amount": "NUMERIC(14,2)",
                "overdraft_fee_amount": "NUMERIC(14,2)",
            },
            "coupon": {"amount": "NUMERIC(14,2)"},
        }

        async def table_info(table: str) -> list[tuple]:
            result = await conn.execute(text(pragma.format(table=table)))
            return result.fetchall()

        async def needs_monetary_rebuild(table: str, columns: dict[str, str]) -> bool:
            info_rows = await table_info(table)
            if not info_rows:
                return False
            type_by_col = {row[1]: (row[2] or "").upper() for row in info_rows}
            for col_name in columns:
                declared = type_by_col.get(col_name)
                if declared and "NUMERIC" not in declared:
                    return True
            return False

        async def rebuild_table_with_numeric_columns(
            table: str, cast_columns: dict[str, str]
        ) -> None:
            def q(identifier: str) -> str:
                return f'"{identifier}"'

            legacy_table = f"{table}__legacy_numeric"
            info_rows = await table_info(table)
            source_columns = {row[1] for row in info_rows}

            await conn.execute(
                text(f"ALTER TABLE {q(table)} RENAME TO {q(legacy_table)}")
            )

            def _create_target(sync_conn):
                SQLModel.metadata.tables[table].create(sync_conn)

            await conn.run_sync(_create_target)

            target_columns = [
                col.name for col in SQLModel.metadata.tables[table].columns
            ]
            insert_columns = [col for col in target_columns if col in source_columns]
            select_exprs: list[str] = []
            for col in insert_columns:
                numeric_type = cast_columns.get(col)
                if numeric_type:
                    select_exprs.append(
                        f"CAST({q(col)} AS {numeric_type}) AS {q(col)}"
                    )
                else:
                    select_exprs.append(q(col))

            if insert_columns:
                quoted_columns = ", ".join(q(col) for col in insert_columns)
                await conn.execute(
                    text(
                        f"INSERT INTO {q(table)} ({quoted_columns}) "
                        f"SELECT {', '.join(select_exprs)} FROM {q(legacy_table)}"
                    )
                )

            await conn.execute(text(f"DROP TABLE {q(legacy_table)}"))

        await conn.execute(text("PRAGMA foreign_keys=OFF"))
        try:
            for table_name, money_cols in monetary_columns.items():
                if await needs_monetary_rebuild(table_name, money_cols):
                    await rebuild_table_with_numeric_columns(table_name, money_cols)
        finally:
            await conn.execute(text("PRAGMA foreign_keys=ON"))


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
