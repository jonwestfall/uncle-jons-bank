"""Endpoints for simple user messaging."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_session
from app.schemas import MessageCreate, MessageRead, BroadcastMessageCreate
from app.models import User, Child, Message
from app.auth import get_current_identity, get_current_user
from app.crud import (
    create_message,
    list_inbox,
    list_sent,
    archive_message,
    get_message,
    get_all_messages,
    get_child_user_link,
    get_all_users,
    get_all_children,
)

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("/", response_model=MessageRead)
async def send_message(
    data: MessageCreate,
    identity=Depends(get_current_identity),
    db: AsyncSession = Depends(get_session),
):
    sender_type, sender = identity
    if data.recipient_child_id and data.recipient_user_id:
        raise HTTPException(status_code=400, detail="Specify only one recipient")
    if not data.recipient_child_id and not data.recipient_user_id:
        raise HTTPException(status_code=400, detail="Recipient required")

    msg = Message(subject=data.subject, body=data.body)
    if sender_type == "user":
        msg.sender_user_id = sender.id
        if data.recipient_child_id:
            if sender.role != "admin":
                link = await get_child_user_link(
                    db, sender.id, data.recipient_child_id
                )
                if not link:
                    raise HTTPException(status_code=404, detail="Child not found")
            msg.recipient_child_id = data.recipient_child_id
        else:
            if sender.role != "admin":
                raise HTTPException(status_code=403, detail="Cannot message user")
            msg.recipient_user_id = data.recipient_user_id
    else:  # child sender
        msg.sender_child_id = sender.id
        if not data.recipient_user_id or data.recipient_child_id:
            raise HTTPException(status_code=400, detail="Child must message parent")
        link = await get_child_user_link(db, data.recipient_user_id, sender.id)
        if not link:
            raise HTTPException(status_code=404, detail="Parent not linked")
        msg.recipient_user_id = data.recipient_user_id

    new_msg = await create_message(db, msg)
    return new_msg


@router.post("/broadcast")
async def broadcast_message(
    data: BroadcastMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    count = 0
    recipients = []
    if data.target in ("all", "parents"):
        users = await get_all_users(db)
        for u in users:
            if u.id == current_user.id:
                continue
            if data.target == "all" or u.role != "admin":
                recipients.append(("user", u.id))
    if data.target in ("all", "children"):
        children = await get_all_children(db)
        for c in children:
            recipients.append(("child", c.id))
    for typ, rid in recipients:
        msg = Message(
            subject=data.subject,
            body=data.body,
            sender_user_id=current_user.id,
            recipient_user_id=rid if typ == "user" else None,
            recipient_child_id=rid if typ == "child" else None,
        )
        await create_message(db, msg)
        count += 1
    return {"count": count}


@router.get("/inbox", response_model=list[MessageRead])
async def inbox(
    identity=Depends(get_current_identity),
    db: AsyncSession = Depends(get_session),
):
    sender_type, sender = identity
    if sender_type == "user":
        return await list_inbox(db, user_id=sender.id)
    else:
        return await list_inbox(db, child_id=sender.id)


@router.get("/sent", response_model=list[MessageRead])
async def sent(
    identity=Depends(get_current_identity),
    db: AsyncSession = Depends(get_session),
):
    sender_type, sender = identity
    if sender_type == "user":
        return await list_sent(db, user_id=sender.id)
    else:
        return await list_sent(db, child_id=sender.id)


@router.get("/archive", response_model=list[MessageRead])
async def archive_list(
    identity=Depends(get_current_identity),
    db: AsyncSession = Depends(get_session),
):
    sender_type, sender = identity
    if sender_type == "user":
        return await list_inbox(db, user_id=sender.id, archived=True)
    else:
        return await list_inbox(db, child_id=sender.id, archived=True)


@router.post("/{message_id}/archive", response_model=MessageRead)
async def archive_msg(
    message_id: int,
    identity=Depends(get_current_identity),
    db: AsyncSession = Depends(get_session),
):
    sender_type, sender = identity
    msg = await get_message(db, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Not found")
    if sender_type == "user":
        if msg.recipient_user_id == sender.id:
            return await archive_message(db, msg)
        if msg.sender_user_id == sender.id:
            return await archive_message(db, msg, as_sender=True)
    else:
        if msg.recipient_child_id == sender.id:
            return await archive_message(db, msg)
        if msg.sender_child_id == sender.id:
            return await archive_message(db, msg, as_sender=True)
    raise HTTPException(status_code=403, detail="Cannot archive")


@router.get("/all", response_model=list[MessageRead])
async def all_messages(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return await get_all_messages(db)


@router.get("/{message_id}", response_model=MessageRead)
async def read_message(
    message_id: int,
    identity=Depends(get_current_identity),
    db: AsyncSession = Depends(get_session),
):
    sender_type, sender = identity
    msg = await get_message(db, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Not found")
    authorized = False
    updated = False
    if sender_type == "user":
        if msg.recipient_user_id == sender.id:
            authorized = True
            if not msg.read:
                msg.read = True
                db.add(msg)
                updated = True
        if msg.sender_user_id == sender.id:
            authorized = True
    else:
        if msg.recipient_child_id == sender.id:
            authorized = True
            if not msg.read:
                msg.read = True
                db.add(msg)
                updated = True
        if msg.sender_child_id == sender.id:
            authorized = True
    if not authorized:
        raise HTTPException(status_code=403, detail="Forbidden")
    if updated:
        await db.commit()
        await db.refresh(msg)
    return msg
