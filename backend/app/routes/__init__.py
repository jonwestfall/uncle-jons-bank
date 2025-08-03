"""Aggregate import for all API route modules."""

from . import (
    auth,
    users,
    children,
    transactions,
    withdrawals,
    admin,
    tests,
    cds,
    settings,
    recurring,
    loans,
)

__all__ = [
    "auth",
    "users",
    "children",
    "transactions",
    "withdrawals",
    "cds",
    "settings",
    "admin",
    "tests",
    "recurring",
    "loans",
]
