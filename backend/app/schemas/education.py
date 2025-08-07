from typing import List
from sqlmodel import SQLModel

class QuizQuestionRead(SQLModel):
    id: int
    prompt: str
    options: List[str]

class ModuleRead(SQLModel):
    id: int
    title: str
    content: str
    questions: List[QuizQuestionRead]
    badge_earned: bool = False

class QuizSubmission(SQLModel):
    answers: List[int]

class QuizResult(SQLModel):
    score: int
    passed: bool
    badge_awarded: bool

class BadgeRead(SQLModel):
    id: int
    name: str
    module_id: int | None = None

class ModuleUpdate(SQLModel):
    enabled: bool
