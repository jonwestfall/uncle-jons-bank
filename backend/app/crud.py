from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.models import User, Child, ChildUserLink
from app.auth import get_password_hash, get_child_by_id

async def create_user(db: AsyncSession, user: User):
    if not user.password_hash.startswith("$2b$"):
        user.password_hash = get_password_hash(user.password_hash)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

async def get_user_by_email(db: AsyncSession, email: str):
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()

async def create_child(db: AsyncSession, child: Child):
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return child


async def create_child_for_user(db: AsyncSession, child: Child, user_id: int):
    db.add(child)
    await db.commit()
    await db.refresh(child)

    link = ChildUserLink(user_id=user_id, child_id=child.id)
    db.add(link)
    await db.commit()
    return child

async def get_children_by_user(db: AsyncSession, user_id: int):
    query = (
        select(Child)
        .join(ChildUserLink)
        .where(ChildUserLink.user_id == user_id)
    )
    result = await db.execute(query)
    return result.scalars().all()


async def get_child_by_access_code(db: AsyncSession, access_code: str):
    result = await db.execute(select(Child).where(Child.access_code == access_code))
    return result.scalar_one_or_none()
