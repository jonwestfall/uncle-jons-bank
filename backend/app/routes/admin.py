from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.auth import require_role, get_password_hash
from app.models import User, Child, Transaction
from app.schemas import (
    UserResponse, UserUpdate,
    ChildRead, ChildUpdate,
    TransactionRead, TransactionUpdate,
)
from app.crud import (
    get_all_users, get_user, save_user, delete_user,
    get_all_children, get_child, save_child, delete_child,
    get_all_transactions, get_transaction, save_transaction, delete_transaction,
    get_account_by_child,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserResponse])
async def admin_list_users(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    return await get_all_users(db)


@router.get("/users/{user_id}", response_model=UserResponse)
async def admin_get_user(
    user_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: int,
    data: UserUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.password is not None:
        user.password_hash = get_password_hash(data.password)
    for field, value in data.model_dump(exclude_unset=True, exclude={"password"}).items():
        setattr(user, field, value)
    return await save_user(db, user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await delete_user(db, user)


@router.get("/children", response_model=list[ChildRead])
async def admin_list_children(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    children = await get_all_children(db)
    result = []
    for c in children:
        account = await get_account_by_child(db, c.id)
        result.append(
            ChildRead(
                id=c.id,
                first_name=c.first_name,
                account_frozen=c.account_frozen,
                interest_rate=account.interest_rate if account else None,
                total_interest_earned=account.total_interest_earned if account else None,
            )
        )
    return result


@router.get("/children/{child_id}", response_model=ChildRead)
async def admin_get_child(
    child_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    child = await get_child(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    account = await get_account_by_child(db, child_id)
    return ChildRead(
        id=child.id,
        first_name=child.first_name,
        account_frozen=child.account_frozen,
        interest_rate=account.interest_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.put("/children/{child_id}", response_model=ChildRead)
async def admin_update_child(
    child_id: int,
    data: ChildUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    child = await get_child(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "frozen":
            setattr(child, "account_frozen", value)
        else:
            setattr(child, field, value)
    updated = await save_child(db, child)
    account = await get_account_by_child(db, child_id)
    return ChildRead(
        id=updated.id,
        first_name=updated.first_name,
        account_frozen=updated.account_frozen,
        interest_rate=account.interest_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.delete("/children/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_child(
    child_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    child = await get_child(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    await delete_child(db, child)


@router.get("/transactions", response_model=list[TransactionRead])
async def admin_list_transactions(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    return await get_all_transactions(db)


@router.get("/transactions/{transaction_id}", response_model=TransactionRead)
async def admin_get_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    tx = await get_transaction(db, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@router.put("/transactions/{transaction_id}", response_model=TransactionRead)
async def admin_update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    tx = await get_transaction(db, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)
    updated = await save_transaction(db, tx)
    return updated


@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    tx = await get_transaction(db, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await delete_transaction(db, tx)
