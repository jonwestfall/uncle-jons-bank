"""Pydantic models for user-related API schemas."""

from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, StringConstraints

from app.schemas.validation import SanitizedName


class UserCreate(BaseModel):
    name: Annotated[str, SanitizedName]
    email: EmailStr
    password: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=256)]

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    status: str

    class Config:
        model_config = {"from_attributes": True}


class UserMeResponse(UserResponse):
    permissions: list[str]


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Annotated[str, SanitizedName] | None = None
    email: EmailStr | None = None
    role: Literal["parent", "admin"] | None = None
    status: Literal["active", "pending"] | None = None
    password: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=256)
    ] | None = None


class PasswordChange(BaseModel):
    password: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=256)]
