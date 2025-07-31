from pydantic import BaseModel
from typing import List, Optional

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserRead(BaseModel):
    id: int
    name: str
    email: str

class ChildCreate(BaseModel):
    first_name: str
    access_code: str
    frozen: Optional[bool] = False

class ChildRead(BaseModel):
    id: int
    first_name: str
    frozen: bool
    user_id: int
