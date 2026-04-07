# Money Schema Transition Notes (SQLite)

## What changed
- Monetary fields now use fixed-precision `NUMERIC` columns instead of `FLOAT`.
- Rate/percentage fields used in money calculations also use fixed-precision `NUMERIC`.
- All money math is centralized in `backend/app/money.py` with explicit quantization and rounding (`ROUND_HALF_UP`).

## Migration strategy for existing SQLite data
At startup (`create_db_and_tables`), the app now:
1. Creates current tables for fresh installs (`SQLModel.metadata.create_all`).
2. Applies additive legacy column migrations (existing behavior).
3. Detects legacy tables where money/rate columns are still declared as non-`NUMERIC` (for example `FLOAT`).
4. Rebuilds each affected table in place:
   - Renames old table to `<table>__legacy_numeric`.
   - Creates the new table from current SQLModel metadata.
   - Copies data from old to new table with explicit `CAST(... AS NUMERIC(...))` on migrated money/rate columns.
   - Drops the legacy table.

This is automatic and idempotent: after a table is rebuilt once, subsequent startups skip it.

## Backward-compatible transition behavior
- API request/response schemas remain float-based for compatibility with existing clients.
- Internally, SQLModel values are `Decimal`, and `crud` logic quantizes amounts/rates before persisting or calculating.
- Existing data values are preserved and normalized to the configured precision during copy/cast.

## Operational guidance
- Back up `uncle_jons_bank.db` before deploying the first version that includes this migration.
- First startup after deploy may take longer because table rebuilds copy historical rows.
- If interrupted mid-migration, restart the app; migration routines are rerun and converge on the target schema.
