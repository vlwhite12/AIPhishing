"""
app/models/scan.py
──────────────────
SQLAlchemy ORM model for the `scans` table.

Each row represents one email analysis request made by a user.
The full AI result JSON is stored in `result_json` (JSONB in Postgres)
so we avoid N+1 queries when reconstructing results.

Security note: We store the raw email input so users can review what was
analysed, but access is strictly scoped to the owning user (enforced at
the router layer).
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Scan(Base):
    __tablename__ = "scans"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # ── Ownership ─────────────────────────────────────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Input ─────────────────────────────────────────────────────────────────
    # Raw email text (headers + body) submitted by the user.
    # Max length enforced at the API layer before storage.
    email_input: Mapped[str] = mapped_column(Text, nullable=False)

    # Optional user-provided label, e.g. "Suspicious PayPal email"
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # ── Analysis Result ───────────────────────────────────────────────────────
    risk_score: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    risk_level: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )  # SAFE | LOW | MEDIUM | HIGH | CRITICAL

    # Full structured JSON response from the AI engine.
    # Stored as JSONB (native Postgres type) for efficient querying.
    result_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # ── Status Tracking ───────────────────────────────────────────────────────
    # pending → processing → completed | failed
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="scans")  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Scan id={self.id} risk_score={self.risk_score} status={self.status!r}>"
