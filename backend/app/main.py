from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import users, children, auth
from app.database import create_db_and_tables

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

app.include_router(users.router)
app.include_router(children.router)
app.include_router(auth.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to Uncle Jon's Bank API"}
