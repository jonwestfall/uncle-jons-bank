from pydantic import BaseModel
from typing import Optional

class ChildCreate(BaseModel):
    first_name: str
    access_code: str
    frozen: Optional[bool] = False

class ChildRead(BaseModel):
    id: int
    first_name: str
    frozen: bool
    user_id: int
