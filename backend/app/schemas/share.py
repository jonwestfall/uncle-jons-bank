"""Schemas for sharing children with other parents."""
from pydantic import BaseModel
from typing import List


class ShareCodeCreate(BaseModel):
    permissions: List[str]


class ShareCodeRead(BaseModel):
    code: str


class ParentAccess(BaseModel):
    user_id: int
    name: str
    email: str
    permissions: List[str]
    is_owner: bool

    class Config:
        model_config = {"from_attributes": True}
