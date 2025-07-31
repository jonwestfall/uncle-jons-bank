from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = "sqlite:///./uncle_jons_bank.db"  # swap with Postgres URL if needed
engine = create_engine(DATABASE_URL, echo=True)

def create_db_and_tables():
    from .models import User, Child, ChildUserLink, Account, Transaction
    SQLModel.metadata.create_all(engine)

def get_session():
    return Session(engine)
