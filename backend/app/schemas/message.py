from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, field_validator

from app.schemas.validation import (
    SanitizedMessageBody,
    SanitizedShortText,
    normalize_optional_text,
)


class MessageBase(BaseModel):
    subject: Annotated[str, SanitizedShortText]
    body: Annotated[str, SanitizedMessageBody]

    @field_validator("subject", "body", mode="before")
    @classmethod
    def _normalize_text_fields(cls, value: str) -> str:
        return normalize_optional_text(value) or ""


class MessageCreate(MessageBase):
    recipient_user_id: Optional[int] = None
    recipient_child_id: Optional[int] = None


class BroadcastMessageCreate(MessageBase):
    target: Literal["all", "parents", "children"]


class MessageRead(MessageBase):
    id: int
    sender_user_id: Optional[int] = None
    sender_child_id: Optional[int] = None
    recipient_user_id: Optional[int] = None
    recipient_child_id: Optional[int] = None
    created_at: datetime
    sender_archived: bool
    recipient_archived: bool
    read: bool

    class Config:
        from_attributes = True
