"""
app/database.py
───────────────
Async SQLAlchemy engine + session factory.
Defaults to SQLite (via aiosqlite) — no install required.
Switch DATABASE_URL in .env to a PostgreSQL URL for production.
"""
from typing import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool

from app.config import get_settings

settings = get_settings()

_is_sqlite = settings.database_url.startswith("sqlite")

# ── Engine ────────────────────────────────────────────────────────────────────
# SQLite needs check_same_thread=False and StaticPool for async. PostgreSQL
# uses asyncpg's default pool — do not pass SQLite-specific args there.
_engine_kwargs: dict = {"echo": not settings.is_production}
if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30}
    _engine_kwargs["poolclass"] = StaticPool

engine = create_async_engine(settings.database_url, **_engine_kwargs)

# Enable WAL mode for SQLite: allows concurrent reads alongside writes.
if _is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def _set_wal_mode(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")  # Safe + faster than FULL
        cursor.close()

# ── Session Factory ───────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,  # Avoid lazy-load errors after commit in async context
    class_=AsyncSession,
)


# ── Base Model ────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """All SQLAlchemy ORM models inherit from this class."""
    pass


# ── FastAPI Dependency ────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yields an async database session for each request and guarantees
    cleanup via the finally block.

    Usage:
        async def my_endpoint(db: AsyncSession = Depends(get_db)): ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
