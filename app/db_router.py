from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from typing import Protocol, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

SessionFactory = TypeVar("SessionFactory")


class AsyncSessionFactoryProtocol(Protocol):
    def __call__(self) -> AbstractAsyncContextManager[AsyncSession]: ...


class DbRouter:
    """
    Read/write session router.
    Default mode is single-DB compatible by using write factory for reads too.
    """

    def __init__(
        self,
        *,
        write_factory: AsyncSessionFactoryProtocol,
        read_factory: AsyncSessionFactoryProtocol | None = None,
    ) -> None:
        self.write_factory = write_factory
        self.read_factory = read_factory or write_factory

    @property
    def read_uses_write(self) -> bool:
        return self.read_factory is self.write_factory

    @asynccontextmanager
    async def write_session(self) -> AsyncIterator[AsyncSession]:
        async with self.write_factory() as session:
            yield session

    @asynccontextmanager
    async def read_session(self) -> AsyncIterator[AsyncSession]:
        async with self.read_factory() as session:
            yield session
