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

# ── Engine ────────────────────────────────────────────────────────────────────
# SQLite needs check_same_thread=False when used with async drivers.
# Pool size settings are omitted — SQLite uses a single-file connection.
engine = create_async_engine(
    settings.database_url,
    echo=not settings.is_production,
    connect_args={
        "check_same_thread": False,
        "timeout": 30,
    },
    # Single shared connection for SQLite — avoids cross-thread lock contention
    poolclass=StaticPool,
)

# Enable WAL mode: allows concurrent reads alongside writes, eliminating
# "database is locked" errors when long AI requests hold open sessions.
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
