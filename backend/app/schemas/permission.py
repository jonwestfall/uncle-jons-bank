"""Schemas dealing with user permissions."""

from pydantic import BaseModel


class PermissionRead(BaseModel):
    id: int
    name: str

    class Config:
        model_config = {"from_attributes": True}


class PermissionsUpdate(BaseModel):
    permissions: list[str]
