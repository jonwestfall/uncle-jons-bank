"""Shared schema constraints and text normalization helpers."""

from __future__ import annotations

import re
from typing import Optional

from pydantic import StringConstraints

MoneyAmount = float
RateValue = float

MAX_MONEY_AMOUNT = 1_000_000.0
MAX_RATE = 1.0
MAX_MEMO_LENGTH = 240
MAX_SHORT_TEXT = 120
MAX_LONG_TEXT = 1000
MAX_MESSAGE_BODY = 5000

_single_space_re = re.compile(r"\s+")


def normalize_text(value: str) -> str:
    """Trim text and collapse internal whitespace to single spaces."""

    return _single_space_re.sub(" ", value.strip())


def normalize_optional_text(value: Optional[str]) -> Optional[str]:
    """Normalize optional text; return ``None`` when empty after cleanup."""

    if value is None:
        return None
    cleaned = normalize_text(value)
    return cleaned or None


SanitizedAccessCode = StringConstraints(
    strip_whitespace=True,
    min_length=1,
    max_length=32,
    pattern=r"^[A-Za-z0-9_-]+$",
)

SanitizedName = StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
SanitizedShortText = StringConstraints(
    strip_whitespace=True,
    min_length=1,
    max_length=MAX_SHORT_TEXT,
)
SanitizedLongText = StringConstraints(
    strip_whitespace=True,
    min_length=1,
    max_length=MAX_LONG_TEXT,
)
SanitizedMemo = StringConstraints(
    strip_whitespace=True,
    min_length=1,
    max_length=MAX_MEMO_LENGTH,
)
SanitizedMessageBody = StringConstraints(
    strip_whitespace=True,
    min_length=1,
    max_length=MAX_MESSAGE_BODY,
)
