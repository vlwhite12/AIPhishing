"""
alembic/env.py
───────────────
Alembic migration environment.

Key design choices:
  - Reads DATABASE_URL from the app's Settings (via .env) so credentials
    are never hardcoded in alembic.ini.
  - Converts the async driver URL to a synchronous one for Alembic's runner
    (e.g. sqlite+aiosqlite → sqlite, postgresql+asyncpg → postgresql+psycopg2).
  - All models are imported via `app.models` so Alembic can auto-detect
    schema changes with `--autogenerate`.
"""
import re
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

# ── Load app config & models ──────────────────────────────────────────────────
# Import models so Alembic's autogenerate can see the full schema.
from app.config import get_settings
from app.database import Base
import app.models  # noqa: F401 – ensures User and Scan are registered on Base

settings = get_settings()

# ── Alembic Config ────────────────────────────────────────────────────────────
alembic_cfg = context.config
if alembic_cfg.config_file_name is not None:
    fileConfig(alembic_cfg.config_file_name)

target_metadata = Base.metadata


def _sync_database_url(async_url: str) -> str:
    """
    Strip async driver suffixes so Alembic can use a synchronous connection.
      sqlite+aiosqlite:/// → sqlite:///
      postgresql+asyncpg:// → postgresql+psycopg2://
    """
    # SQLite: just drop the +aiosqlite driver suffix
    if async_url.startswith("sqlite"):
        return async_url.replace("sqlite+aiosqlite", "sqlite", 1)
    # PostgreSQL: swap asyncpg for psycopg2
    return re.sub(
        r"^postgresql(\+asyncpg)?://",
        "postgresql+psycopg2://",
        async_url,
    )


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (generates SQL only)."""
    url = _sync_database_url(settings.database_url)
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against the live database."""
    sync_url = _sync_database_url(settings.database_url)
    engine = create_engine(sync_url, poolclass=None)

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,       # Detect column type changes
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
