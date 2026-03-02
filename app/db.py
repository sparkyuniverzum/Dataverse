import os
from collections.abc import AsyncGenerator
from urllib.parse import quote_plus

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


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
        return (
            "postgresql+asyncpg://"
            f"{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{quote_plus(database)}"
        )

    return "postgresql+asyncpg://postgres:postgres@localhost:5432/dataverse"


DATABASE_URL = resolve_database_url()

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
