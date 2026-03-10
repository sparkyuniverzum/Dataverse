import os
from collections.abc import AsyncGenerator
from urllib.parse import quote_plus

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db_router import DbRouter


def resolve_database_url() -> str:
    explicit = (os.getenv("DATABASE_URL") or "").strip()
    if explicit:
        return explicit

    user = (os.getenv("POSTGRES_USER") or "").strip()
    database = (os.getenv("POSTGRES_DB") or "").strip()
    password = os.getenv("POSTGRES_PASSWORD")
    if user and database and password is not None:
        host = (os.getenv("POSTGRES_HOST") or "localhost").strip() or "localhost"
        port = (os.getenv("POSTGRES_PORT") or "5432").strip() or "5432"
        return f"postgresql+asyncpg://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{quote_plus(database)}"

    return "postgresql+asyncpg://postgres:postgres@localhost:5432/dataverse"


DATABASE_URL = resolve_database_url()
DATABASE_READ_URL = (os.getenv("DATABASE_READ_URL") or "").strip()

engine = create_async_engine(DATABASE_URL, echo=False)
read_engine = create_async_engine(DATABASE_READ_URL, echo=False) if DATABASE_READ_URL else engine
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
AsyncReadSessionLocal = (
    async_sessionmaker(bind=read_engine, class_=AsyncSession, expire_on_commit=False)
    if DATABASE_READ_URL
    else AsyncSessionLocal
)
db_router = DbRouter(write_factory=AsyncSessionLocal, read_factory=AsyncReadSessionLocal)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with db_router.write_session() as session:
        yield session


async def get_write_session() -> AsyncGenerator[AsyncSession, None]:
    async with db_router.write_session() as session:
        yield session


async def get_read_session() -> AsyncGenerator[AsyncSession, None]:
    async with db_router.read_session() as session:
        yield session


async def dispose_db_engines() -> None:
    await engine.dispose()
    if read_engine is not engine:
        await read_engine.dispose()
