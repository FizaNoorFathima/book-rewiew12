import os
import hashlib
import re
import secrets
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Generator

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, create_engine, or_, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:12345@localhost:5432/Sample_Project_3",
)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    author: Mapped[str] = mapped_column(String(200), nullable=True, default="")
    genre: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    watched: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cover_url: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    token: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    token: str
    email: str


class BookCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    author: str = Field(default="", max_length=200)
    genre: str = Field(min_length=1, max_length=50)
    rating: int = Field(ge=1, le=5)
    watched: bool = False
    cover_url: str | None = Field(default=None, max_length=500)


class BookResponse(BookCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        for column, definition in (
            ("user_id", "INTEGER REFERENCES users(id)"),
            ("author", "VARCHAR(200)"),
            ("cover_url", "VARCHAR(500)"),
        ):
            exists = connection.execute(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name = 'books' AND column_name = :column"
                ),
                {"column": column},
            ).fetchone()
            if exists is None:
                connection.execute(text(f"ALTER TABLE books ADD COLUMN {column} {definition}"))
    yield


app = FastAPI(title="Bookmarked API", lifespan=lifespan)
allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
frontend_host = os.getenv("FRONTEND_HOST")
if frontend_host:
    allowed_origins.append(f"https://{frontend_host}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def password_is_valid(password: str) -> bool:
    return bool(re.search(r"[A-Za-z]", password) and re.search(r"\d", password))


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"{salt.hex()}:{digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    salt_hex, digest_hex = stored_hash.split(":", 1)
    expected = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 310_000)
    return secrets.compare_digest(expected.hex(), digest_hex)


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Please log in to continue")
    auth_token = db.get(AuthToken, authorization[7:])
    user = db.get(User, auth_token.user_id) if auth_token else None
    if user is None:
        raise HTTPException(status_code=401, detail="Your session has expired")
    return user


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/register", response_model=AuthResponse, status_code=201)
def register(credentials: Credentials, db: Session = Depends(get_db)) -> AuthResponse:
    email = credentials.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    if not password_is_valid(credentials.password):
        raise HTTPException(status_code=422, detail="Password must contain at least one letter and one number")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(email=email, password_hash=hash_password(credentials.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = secrets.token_urlsafe(48)
    db.add(AuthToken(token=token, user_id=user.id))
    db.commit()
    return AuthResponse(token=token, email=user.email)


@app.post("/api/auth/login", response_model=AuthResponse)
def login(credentials: Credentials, db: Session = Depends(get_db)) -> AuthResponse:
    email = credentials.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    token = secrets.token_urlsafe(48)
    db.add(AuthToken(token=token, user_id=user.id))
    db.commit()
    return AuthResponse(token=token, email=user.email)


@app.get("/api/books", response_model=list[BookResponse])
def list_books(
    search: str = Query(default="", max_length=100),
    watched: str = Query(default="all", pattern="^(all|watched|unwatched)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Book]:
    query = db.query(Book).filter(Book.user_id == user.id)
    if search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(Book.name.ilike(term), Book.author.ilike(term), Book.genre.ilike(term)))
    if watched == "watched":
        query = query.filter(Book.watched.is_(True))
    elif watched == "unwatched":
        query = query.filter(Book.watched.is_(False))
    return query.order_by(Book.created_at.desc()).all()


@app.post("/api/books", response_model=BookResponse, status_code=201)
def create_book(book: BookCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Book:
    new_book = Book(**book.model_dump(), user_id=user.id)
    db.add(new_book)
    db.commit()
    db.refresh(new_book)
    return new_book


@app.delete("/api/books/{book_id}", status_code=204)
def delete_book(book_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    db.delete(book)
    db.commit()
