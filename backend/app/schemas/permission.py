from pydantic import BaseModel
from typing import Optional

class PermissionCreate(BaseModel):
    permission: str
    child_id: Optional[int] = None

class PermissionRead(BaseModel):
    id: int
    permission: str
    child_id: Optional[int] = None

    class Config:
        model_config = {"from_attributes": True}
