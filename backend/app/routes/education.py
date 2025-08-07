"""Routes for educational modules and quizzes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_session
from app.auth import get_current_child, get_current_user
from app.models import Child, User, EducationModule
from app.schemas import (
    ModuleRead,
    QuizSubmission,
    QuizResult,
    BadgeRead,
    ModuleUpdate,
)
from app.crud import (
    get_enabled_modules,
    get_questions_for_module,
    award_badge_for_module,
    get_child_badges,
)
from sqlmodel import select

router = APIRouter(prefix="/education", tags=["education"])


@router.get("/modules", response_model=list[ModuleRead])
async def list_modules(
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    modules = await get_enabled_modules(db)
    badges = await get_child_badges(db, child.id)
    earned_ids = {b.module_id for b in badges if b.module_id is not None}
    return [
        ModuleRead(
            id=m.id,
            title=m.title,
            content=m.content,
            questions=[
                {"id": q.id, "prompt": q.prompt, "options": q.options}
                for q in m.questions
            ],
            badge_earned=m.id in earned_ids,
        )
        for m in modules
    ]


@router.post("/modules/{module_id}/quiz", response_model=QuizResult)
async def submit_quiz(
    module_id: int,
    submission: QuizSubmission,
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    questions = await get_questions_for_module(db, module_id)
    if not questions:
        raise HTTPException(404, detail="Module not found")
    score = 0
    for q, ans in zip(questions, submission.answers):
        if ans == q.answer_index:
            score += 1
    passed = score >= max(1, len(questions) - 1)
    badge_awarded = False
    if passed:
        badge_awarded = await award_badge_for_module(db, child.id, module_id)
    return QuizResult(score=score, passed=passed, badge_awarded=badge_awarded)


@router.get("/badges/me", response_model=list[BadgeRead])
async def my_badges(
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    badges = await get_child_badges(db, child.id)
    return [BadgeRead(id=b.id, name=b.name, module_id=b.module_id) for b in badges]


@router.post("/modules/{module_id}/award/{child_id}")
async def award_badge(
    module_id: int,
    child_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    if user.role != "admin":
        from app.crud import get_children_by_user

        children = await get_children_by_user(db, user.id)
        if child_id not in [c.id for c in children]:
            raise HTTPException(403, detail="Not authorized")
    awarded = await award_badge_for_module(
        db, child_id, module_id, awarded_by=user.id, source="manual"
    )
    if not awarded:
        raise HTTPException(400, detail="Badge already awarded")
    return {"status": "ok"}


@router.put("/modules/{module_id}", response_model=ModuleRead)
async def update_module(
    module_id: int,
    data: ModuleUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    if user.role != "admin":
        raise HTTPException(403, detail="Not authorized")
    result = await db.execute(
        select(EducationModule).where(EducationModule.id == module_id)
    )
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(404, detail="Module not found")
    module.enabled = data.enabled
    db.add(module)
    await db.commit()
    await db.refresh(module)
    return ModuleRead(
        id=module.id,
        title=module.title,
        content=module.content,
        questions=[
            {"id": q.id, "prompt": q.prompt, "options": q.options}
            for q in module.questions
        ],
        badge_earned=False,
    )
