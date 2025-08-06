from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MessageBase(BaseModel):
    subject: str
    body: str


class MessageCreate(MessageBase):
    recipient_user_id: Optional[int] = None
    recipient_child_id: Optional[int] = None


class BroadcastMessageCreate(MessageBase):
    target: str  # 'all', 'parents', 'children'


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
