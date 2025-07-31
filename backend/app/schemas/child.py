from pydantic import BaseModel, Field
from typing import Optional

class ChildCreate(BaseModel):
    first_name: str
    access_code: str
    frozen: Optional[bool] = False

class ChildRead(BaseModel):
    id: int
    first_name: str
    frozen: bool = Field(alias="account_frozen")

    class Config:
        model_config = {"from_attributes": True}


class ChildLogin(BaseModel):
    access_code: str
