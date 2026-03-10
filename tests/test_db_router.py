from __future__ import annotations

import asyncio
from dataclasses import dataclass

from app.db_router import DbRouter


@dataclass
class _SessionStub:
    name: str


class _FactoryStub:
    def __init__(self, name: str) -> None:
        self.name = name
        self.calls = 0

    def __call__(self):
        parent = self

        class _Ctx:
            async def __aenter__(self):
                parent.calls += 1
                return _SessionStub(parent.name)

            async def __aexit__(self, exc_type, exc, tb):
                _ = (exc_type, exc, tb)
                return False

        return _Ctx()


def test_db_router_single_db_mode_routes_reads_to_write_factory() -> None:
    write_factory = _FactoryStub("write")
    router = DbRouter(write_factory=write_factory)

    async def _run():
        async with router.write_session() as write_session:
            assert write_session.name == "write"
        async with router.read_session() as read_session:
            assert read_session.name == "write"

    asyncio.run(_run())
    assert router.read_uses_write is True
    assert write_factory.calls == 2


def test_db_router_split_mode_uses_distinct_factories() -> None:
    write_factory = _FactoryStub("write")
    read_factory = _FactoryStub("read")
    router = DbRouter(write_factory=write_factory, read_factory=read_factory)

    async def _run():
        async with router.write_session() as write_session:
            assert write_session.name == "write"
        async with router.read_session() as read_session:
            assert read_session.name == "read"

    asyncio.run(_run())
    assert router.read_uses_write is False
    assert write_factory.calls == 1
    assert read_factory.calls == 1
