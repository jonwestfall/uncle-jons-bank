from enum import Enum
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_session
from .auth import get_current_user
from .models import User
from .crud import user_has_permission


class Permission(str, Enum):
    ADD_TRANSACTION = "add_transaction"
    VIEW_TRANSACTIONS = "view_transactions"
    DELETE_TRANSACTION = "delete_transaction"
    DEPOSIT = "deposit"
    DEBIT = "debit"
    ADD_CHILD = "add_child"
    REMOVE_CHILD = "remove_child"
    MANAGE_FREEZE = "manage_freeze"


PARENT_DEFAULT_GLOBAL = {Permission.ADD_CHILD, Permission.REMOVE_CHILD}
PARENT_DEFAULT_CHILD = {
    Permission.ADD_TRANSACTION,
    Permission.VIEW_TRANSACTIONS,
    Permission.DELETE_TRANSACTION,
    Permission.DEPOSIT,
    Permission.DEBIT,
    Permission.MANAGE_FREEZE,
}


def require_permission(permission: Permission):
    async def dependency(
        child_id: int | None = None,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_session),
    ) -> User:
        if current_user.role == "admin":
            return current_user
        has_perm = await user_has_permission(db, current_user.id, permission.value, child_id)
        if not has_perm:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return dependency


async def ensure_permission(
    user: User,
    db: AsyncSession,
    permission: Permission,
    child_id: int | None = None,
) -> None:
    if user.role == "admin":
        return
    if not await user_has_permission(db, user.id, permission.value, child_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
