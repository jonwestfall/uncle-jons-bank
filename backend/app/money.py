"""Centralized money math helpers using fixed-precision decimals."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Union

MoneyLike = Union[Decimal, int, float, str]

ROUNDING_MODE = ROUND_HALF_UP
MONEY_QUANTIZER = Decimal("0.01")
RATE_QUANTIZER = Decimal("0.000001")

ZERO_MONEY = Decimal("0.00")
ZERO_RATE = Decimal("0.000000")


def as_decimal(value: MoneyLike | None, *, default: Decimal = ZERO_MONEY) -> Decimal:
    """Convert arbitrary numeric input into Decimal safely."""

    if value is None:
        return default
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def quantize_money(value: MoneyLike | None) -> Decimal:
    return as_decimal(value).quantize(MONEY_QUANTIZER, rounding=ROUNDING_MODE)


def quantize_rate(value: MoneyLike | None) -> Decimal:
    return as_decimal(value, default=ZERO_RATE).quantize(
        RATE_QUANTIZER, rounding=ROUNDING_MODE
    )


def multiply_rate(amount: MoneyLike, rate: MoneyLike) -> Decimal:
    """Apply a rate (e.g. 0.01 == 1%) to an amount and quantize to cents."""

    return quantize_money(as_decimal(amount) * as_decimal(rate))


def percentage_of(amount: MoneyLike, percentage: MoneyLike) -> Decimal:
    """Alias for readability when a config value is a percentage/rate."""

    return multiply_rate(amount, percentage)
