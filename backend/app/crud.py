from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.models import User, Child

async def create_user(db: AsyncSession, user: User):
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

async def get_children_by_user(db: AsyncSession, user_id: int):
    result = await db.execute(select(Child).where(Child.user_id == user_id))
    return result.scalars().all()
