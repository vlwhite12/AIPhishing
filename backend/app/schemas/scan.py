"""
app/schemas/scan.py
────────────────────
Pydantic v2 schemas for the Scan history API responses.
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.analysis import AIAnalysisResult, RiskLevel


class ScanSummary(BaseModel):
    """
    Lightweight scan record for list / history views.
    Does NOT include the full result_json to keep payloads small.
    """
    id: uuid.UUID
    label: Optional[str]
    risk_score: Optional[int]
    risk_level: Optional[RiskLevel]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ScanDetail(BaseModel):
    """
    Full scan record including the AI analysis result.
    Used when the user opens an individual scan.
    """
    id: uuid.UUID
    label: Optional[str]
    email_input: str
    risk_score: Optional[int]
    risk_level: Optional[RiskLevel]
    result_json: Optional[AIAnalysisResult]
    status: str
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ScanListResponse(BaseModel):
    items: list[ScanSummary]
    total: int
    page: int
    page_size: int
