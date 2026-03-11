"""
app/routers/history.py
───────────────────────
Scan history endpoints (authenticated users only):
  GET  /api/history            – Paginated list of the user's scans
  GET  /api/history/{scan_id}  – Full detail for a single scan
  DELETE /api/history/{scan_id} – Delete a scan record

Security notes:
  - ALL queries filter by current_user.id to ensure users can ONLY access
    their own scans (Broken Access Control prevention).
  - scan_id is a UUID; malformed IDs return 422 automatically via FastAPI
    path parameter validation.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.scan import Scan
from app.models.user import User
from app.schemas.scan import ScanDetail, ScanListResponse, ScanSummary
from app.schemas.analysis import AIAnalysisResult
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/history", tags=["History"])


@router.get(
    "",
    response_model=ScanListResponse,
    summary="List the authenticated user's scan history (paginated)",
)
async def list_scans(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Results per page"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScanListResponse:
    offset = (page - 1) * page_size

    # Total count for pagination metadata
    count_result = await db.execute(
        select(func.count(Scan.id)).where(Scan.user_id == current_user.id)
    )
    total = count_result.scalar_one()

    # Fetch the requested page, newest first
    scans_result = await db.execute(
        select(Scan)
        .where(Scan.user_id == current_user.id)
        .order_by(Scan.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    scans = scans_result.scalars().all()

    return ScanListResponse(
        items=[ScanSummary.model_validate(s) for s in scans],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{scan_id}",
    response_model=ScanDetail,
    summary="Get the full detail of a single scan",
)
async def get_scan(
    scan_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScanDetail:
    result = await db.execute(
        select(Scan).where(
            Scan.id == scan_id,
            Scan.user_id == current_user.id,  # ← MUST filter by owner
        )
    )
    scan = result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found.",
        )

    # Convert the stored dict back to a typed AIAnalysisResult
    parsed_result = (
        AIAnalysisResult.model_validate(scan.result_json)
        if scan.result_json
        else None
    )

    return ScanDetail(
        id=scan.id,
        label=scan.label,
        email_input=scan.email_input,
        risk_score=scan.risk_score,
        risk_level=scan.risk_level,
        result_json=parsed_result,
        status=scan.status,
        error_message=scan.error_message,
        created_at=scan.created_at,
        completed_at=scan.completed_at,
    )


@router.delete(
    "/{scan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Permanently delete a scan record",
)
async def delete_scan(
    scan_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Scan).where(
            Scan.id == scan_id,
            Scan.user_id == current_user.id,  # ← MUST filter by owner
        )
    )
    scan = result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found.",
        )
    await db.delete(scan)
