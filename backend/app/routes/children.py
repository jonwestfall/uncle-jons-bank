"""Routes for managing child accounts and related settings."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import (
    ChildCreate,
    ChildRead,
    ChildLogin,
    InterestRateUpdate,
    PenaltyRateUpdate,
    CDPenaltyRateUpdate,
    AccessCodeUpdate,
    ShareCodeCreate,
    ShareCodeRead,
    ParentAccess,
)
from app.models import Child, User
from app.database import get_session
from app.crud import (
    create_child_for_user,
    get_children_by_user,
    get_child_by_id,
    get_child_by_access_code,
    set_child_frozen,
    set_interest_rate,
    set_penalty_interest_rate,
    set_cd_penalty_rate,
    get_account_by_child,
    recalc_interest,
    save_child,
    get_child_user_link,
    create_share_code,
    get_share_code,
    mark_share_code_used,
    link_child_to_user,
    get_parents_for_child,
    remove_child_link,
)
from app.auth import (
    get_current_user,
    require_role,
    create_access_token,
    require_permissions,
    get_current_identity,
)
from app.acl import (
    PERM_ADD_CHILD,
    PERM_REMOVE_CHILD,
    PERM_FREEZE_CHILD,
    PERM_VIEW_TRANSACTIONS,
)

router = APIRouter(prefix="/children", tags=["children"])


async def _ensure_link(
    db: AsyncSession,
    user_id: int,
    child_id: int,
    perm: str | None = None,
    require_owner: bool = False,
):
    link = await get_child_user_link(db, user_id, child_id)
    if not link:
        raise HTTPException(status_code=404, detail="Child not found")
    if require_owner and not link.is_owner:
        raise HTTPException(status_code=403, detail="Not authorized")
    if perm and perm not in link.permissions and link.is_owner is False:
        # owners implicitly have all permissions
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return link


@router.get("/me", response_model=ChildRead)
async def read_current_child(
    identity: tuple[str, Child | User] = Depends(get_current_identity),
    db: AsyncSession = Depends(get_session),
):
    kind, obj = identity
    if kind == "child":
        child = obj
    else:
        raise HTTPException(status_code=403, detail="Not a child token")
    account = await get_account_by_child(db, child.id)
    return ChildRead(
        id=child.id,
        first_name=child.first_name,
        account_frozen=child.account_frozen,
        interest_rate=account.interest_rate if account else None,
        penalty_interest_rate=account.penalty_interest_rate if account else None,
        cd_penalty_rate=account.cd_penalty_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.post("/{child_id}/sharecode", response_model=ShareCodeRead)
async def generate_share_code(
    child_id: int,
    data: ShareCodeCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    child = await get_child_by_id(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    if current_user.role != "admin":
        await _ensure_link(db, current_user.id, child_id, require_owner=True)
    share = await create_share_code(db, child_id, current_user.id, data.permissions)
    return ShareCodeRead(code=share.code)


@router.post("/sharecode/{code}", response_model=ChildRead)
async def redeem_share_code(
    code: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    share = await get_share_code(db, code)
    if not share or share.used_by is not None:
        raise HTTPException(status_code=404, detail="Invalid code")
    if current_user.role != "admin":
        existing = await get_child_user_link(db, current_user.id, share.child_id)
        if existing:
            raise HTTPException(status_code=400, detail="Already linked")
    await link_child_to_user(db, share.child_id, current_user.id, share.permissions)
    await mark_share_code_used(db, share, current_user.id)
    child = await get_child_by_id(db, share.child_id)
    account = await get_account_by_child(db, share.child_id)
    return ChildRead(
        id=child.id,
        first_name=child.first_name,
        account_frozen=child.account_frozen,
        interest_rate=account.interest_rate if account else None,
        penalty_interest_rate=account.penalty_interest_rate if account else None,
        cd_penalty_rate=account.cd_penalty_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.get("/{child_id}/parents", response_model=list[ParentAccess])
async def list_child_parents(
    child_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    child = await get_child_by_id(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    if current_user.role != "admin":
        await _ensure_link(db, current_user.id, child_id, require_owner=True)
    links = await get_parents_for_child(db, child_id)
    return [
        ParentAccess(
            user_id=l.user.id,
            name=l.user.name,
            email=l.user.email,
            permissions=l.permissions,
            is_owner=l.is_owner,
        )
        for l in links
    ]


@router.delete("/{child_id}/parents/{parent_id}", status_code=204)
async def remove_parent_access(
    child_id: int,
    parent_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    child = await get_child_by_id(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    if current_user.role != "admin":
        await _ensure_link(db, current_user.id, child_id, require_owner=True)
    link = await get_child_user_link(db, parent_id, child_id)
    if not link or link.is_owner:
        raise HTTPException(status_code=404, detail="Parent not found")
    await remove_child_link(db, child_id, parent_id)
    return


@router.put("/{child_id}/access-code", response_model=ChildRead)
async def update_access_code(
    child_id: int,
    data: AccessCodeUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    """Update the login access code for a child."""

    child = await get_child_by_id(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    if current_user.role != "admin":
        await _ensure_link(db, current_user.id, child_id, require_owner=True)
    existing = await get_child_by_access_code(db, data.access_code)
    if existing and existing.id != child_id:
        raise HTTPException(status_code=400, detail="Access code already in use")
    child.access_code = data.access_code
    updated = await save_child(db, child)
    account = await get_account_by_child(db, updated.id)
    return ChildRead(
        id=updated.id,
        first_name=updated.first_name,
        account_frozen=updated.account_frozen,
        interest_rate=account.interest_rate if account else None,
        penalty_interest_rate=account.penalty_interest_rate if account else None,
        cd_penalty_rate=account.cd_penalty_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.post("/", response_model=ChildRead)
async def create_child_route(
    child: ChildCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_ADD_CHILD)),
):
    """Create a new child and associated account for the current parent."""
    existing = await get_child_by_access_code(db, child.access_code)
    if existing:
        raise HTTPException(status_code=400, detail="Access code already in use")
    child_model = Child(
        first_name=child.first_name,
        access_code=child.access_code,
        account_frozen=child.frozen,
    )
    new_child = await create_child_for_user(db, child_model, current_user.id)
    account = await get_account_by_child(db, new_child.id)
    return ChildRead(
        id=new_child.id,
        first_name=new_child.first_name,
        account_frozen=new_child.account_frozen,
        interest_rate=account.interest_rate if account else None,
        penalty_interest_rate=account.penalty_interest_rate if account else None,
        cd_penalty_rate=account.cd_penalty_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.get("/", response_model=list[ChildRead])
async def list_children(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_ADD_CHILD)),
):
    """List children belonging to the authenticated parent."""
    children = await get_children_by_user(db, current_user.id)
    result = []
    for c in children:
        account = await get_account_by_child(db, c.id)
        result.append(
            ChildRead(
                id=c.id,
                first_name=c.first_name,
                account_frozen=c.account_frozen,
                interest_rate=account.interest_rate if account else None,
                penalty_interest_rate=account.penalty_interest_rate if account else None,
                cd_penalty_rate=account.cd_penalty_rate if account else None,
                total_interest_earned=(
                    account.total_interest_earned if account else None
                ),
            )
        )
    return result


@router.get("/{child_id}", response_model=ChildRead)
async def get_child_route(
    child_id: int,
    db: AsyncSession = Depends(get_session),
    identity: tuple[str, Child | User] = Depends(get_current_identity),
):
    kind, obj = identity
    if kind == "child":
        child = obj
        if child.id != child_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        user: User = obj
        if user.role != "admin":
            user_perms = {p.name for p in user.permissions}
            if PERM_VIEW_TRANSACTIONS not in user_perms:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            children = await get_children_by_user(db, user.id)
            if child_id not in [c.id for c in children]:
                raise HTTPException(status_code=404, detail="Child not found")
        child = await get_child_by_id(db, child_id)
        if not child:
            raise HTTPException(status_code=404, detail="Child not found")
    account = await get_account_by_child(db, child_id)
    return ChildRead(
        id=child.id,
        first_name=child.first_name,
        account_frozen=child.account_frozen,
        interest_rate=account.interest_rate if account else None,
        penalty_interest_rate=account.penalty_interest_rate if account else None,
        cd_penalty_rate=account.cd_penalty_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.post("/{child_id}/freeze", response_model=ChildRead)
async def freeze_child(
    child_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_FREEZE_CHILD)),
):
    child = await get_child_by_id(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    if current_user.role != "admin":
        await _ensure_link(db, current_user.id, child_id, PERM_FREEZE_CHILD)
    updated = await set_child_frozen(db, child_id, True)
    account = await get_account_by_child(db, child_id)
    return ChildRead(
        id=updated.id,
        first_name=updated.first_name,
        account_frozen=updated.account_frozen,
        interest_rate=account.interest_rate if account else None,
        penalty_interest_rate=account.penalty_interest_rate if account else None,
        cd_penalty_rate=account.cd_penalty_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.post("/{child_id}/unfreeze", response_model=ChildRead)
async def unfreeze_child(
    child_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_FREEZE_CHILD)),
):
    child = await get_child_by_id(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    if current_user.role != "admin":
        children = await get_children_by_user(db, current_user.id)
        if child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    updated = await set_child_frozen(db, child_id, False)
    account = await get_account_by_child(db, child_id)
    return ChildRead(
        id=updated.id,
        first_name=updated.first_name,
        account_frozen=updated.account_frozen,
        interest_rate=account.interest_rate if account else None,
        penalty_interest_rate=account.penalty_interest_rate if account else None,
        cd_penalty_rate=account.cd_penalty_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.put("/{child_id}/interest-rate", response_model=ChildRead)
async def update_interest_rate(
    child_id: int,
    data: InterestRateUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    child = await get_child_by_id(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    if current_user.role != "admin":
        children = await get_children_by_user(db, current_user.id)
        if child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    await recalc_interest(db, child_id)
    try:
        account = await set_interest_rate(db, child_id, data.interest_rate)
    except ValueError:
        raise HTTPException(status_code=404, detail="Account not found")
    return ChildRead(
        id=child.id,
        first_name=child.first_name,
        account_frozen=child.account_frozen,
        interest_rate=account.interest_rate if account else None,
        penalty_interest_rate=account.penalty_interest_rate if account else None,
        cd_penalty_rate=account.cd_penalty_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.put("/{child_id}/penalty-interest-rate", response_model=ChildRead)
async def update_penalty_interest_rate(
    child_id: int,
    data: PenaltyRateUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    child = await get_child_by_id(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    if current_user.role != "admin":
        children = await get_children_by_user(db, current_user.id)
        if child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    await recalc_interest(db, child_id)
    try:
        account = await set_penalty_interest_rate(
            db, child_id, data.penalty_interest_rate
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Account not found")
    return ChildRead(
        id=child.id,
        first_name=child.first_name,
        account_frozen=child.account_frozen,
        interest_rate=account.interest_rate if account else None,
        penalty_interest_rate=account.penalty_interest_rate if account else None,
        cd_penalty_rate=account.cd_penalty_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.put("/{child_id}/cd-penalty-rate", response_model=ChildRead)
async def update_cd_penalty_rate(
    child_id: int,
    data: CDPenaltyRateUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    child = await get_child_by_id(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    if current_user.role != "admin":
        children = await get_children_by_user(db, current_user.id)
        if child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    try:
        account = await set_cd_penalty_rate(db, child_id, data.cd_penalty_rate)
    except ValueError:
        raise HTTPException(status_code=404, detail="Account not found")
    return ChildRead(
        id=child.id,
        first_name=child.first_name,
        account_frozen=child.account_frozen,
        interest_rate=account.interest_rate if account else None,
        penalty_interest_rate=account.penalty_interest_rate if account else None,
        cd_penalty_rate=account.cd_penalty_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.post("/login")
async def child_login(
    credentials: ChildLogin,
    db: AsyncSession = Depends(get_session),
):
    """Issue a token for a child using their access code."""
    child = await get_child_by_access_code(db, credentials.access_code)
    if not child:
        raise HTTPException(status_code=401, detail="Invalid access code")
    if child.account_frozen:
        raise HTTPException(status_code=403, detail="Account is frozen")
    token = create_access_token(data={"sub": f"child:{child.id}"})
    return {"access_token": token, "token_type": "bearer"}
