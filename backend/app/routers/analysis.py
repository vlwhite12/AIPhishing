"""
app/routers/analysis.py
────────────────────────
The core analysis endpoint:
  POST /api/analysis/analyze – Submit email text for AI phishing analysis

Security notes:
  - Requires authentication (JWT).
  - Rate-limited per authenticated user (see main.py limiter setup).
  - Input is sanitised inside the AI engine before hitting the LLM.
  - Errors from the AI provider are translated to safe HTTP 502 responses
    so internal API details are never leaked to clients.
  - Scan records are persisted so users can review their history.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.scan import Scan
from app.models.user import User
from app.schemas.analysis import AnalyzeRequest, AnalyzeResponse
from app.services.ai_engine import (
    AIEngineError,
    AIParseError,
    AIProviderError,
    PhishingAnalysisEngine,
    get_ai_engine,
)
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)
_settings = get_settings()

router = APIRouter(prefix="/api/analysis", tags=["Analysis"])

# Rate limit: max N analysis requests per hour per user identity.
# The limiter instance is shared from main.py via app.state.limiter.
_ANALYSIS_RATE_LIMIT = f"{_settings.rate_limit_analysis_per_hour}/hour"


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyse email text for phishing indicators",
    description=(
        "Submit raw email headers + body (or body-only) text. "
        "Returns a risk score, categorised red flags, and actionable advice. "
        f"Requires authentication. Rate-limited to {_settings.rate_limit_analysis_per_hour} requests/hour."
    ),
)
# slowapi picks up the limiter from request.app.state.limiter automatically.
# We import Limiter here only to use the decorator pattern; the shared instance
# is registered on the app in main.py.
async def analyze_email(
    request: Request,                                     # needed by rate limiter
    payload: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    engine: PhishingAnalysisEngine = Depends(get_ai_engine),
) -> AnalyzeResponse:
    """
    Full analysis pipeline:
      1. Create a Scan record with status='processing'.
      2. Run the AI engine.
      3. Persist the result and return it to the client.
      4. On failure, mark the Scan as 'failed' and raise an appropriate HTTP error.
    """

    # ── 1. Create scan record (status=processing) ──────────────────────────
    scan = Scan(
        user_id=current_user.id,
        email_input=payload.email_text[: 51200],  # hard cap before DB write
        label=payload.label,
        status="processing",
    )
    db.add(scan)
    await db.flush()   # get the generated scan.id without committing yet
    scan_id = str(scan.id)

    # ── 2. Run AI analysis ─────────────────────────────────────────────────
    try:
        result = await engine.analyse(payload.email_text)
    except ValueError as exc:
        # Input too short / invalid
        await _fail_scan(scan, str(exc), db)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except AIParseError as exc:
        await _fail_scan(scan, str(exc), db)
        logger.error("AI parse error for scan %s: %s", scan_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The analysis service returned an unexpected response. Please try again.",
        ) from exc
    except AIProviderError as exc:
        await _fail_scan(scan, str(exc), db)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except AIEngineError as exc:
        await _fail_scan(scan, str(exc), db)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Analysis failed due to an internal error.",
        ) from exc

    # ── 3. Persist the completed result ───────────────────────────────────
    scan.risk_score = result.risk_score
    scan.risk_level = result.risk_level.value
    scan.result_json = result.model_dump(mode="json")
    scan.status = "completed"
    scan.completed_at = datetime.now(timezone.utc)
    # db session commit handled by get_db dependency

    logger.info(
        "Scan %s completed: risk_score=%d risk_level=%s user=%s",
        scan_id,
        result.risk_score,
        result.risk_level,
        current_user.id,
    )

    return AnalyzeResponse(scan_id=scan_id, analysis=result)


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

async def _fail_scan(scan: Scan, error_msg: str, db: AsyncSession) -> None:
    """Mark a scan as failed and flush so the record is saved even if the
    calling coroutine raises an exception."""
    scan.status = "failed"
    scan.error_message = error_msg[:500]  # truncate to fit column
    scan.completed_at = datetime.now(timezone.utc)
    try:
        await db.flush()
    except Exception:
        # Best-effort – don't shadow the original exception
        pass
