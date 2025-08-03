"""Schema for applying a promotional credit or debit."""

from pydantic import BaseModel


class Promotion(BaseModel):
    amount: float
    is_percentage: bool = False
    credit: bool = True
    memo: str | None = None
