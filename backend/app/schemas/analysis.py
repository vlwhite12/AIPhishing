"""
app/schemas/analysis.py
────────────────────────
Pydantic v2 schemas that model the AI engine's structured JSON output.

These schemas serve a dual purpose:
  1. Validate / parse the raw JSON string returned by the LLM.
  2. Define the API response shape returned to the frontend.

Strict typing here means the frontend can rely on a guaranteed structure
even if the LLM is slightly non-deterministic.
"""
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ── Enumerations ──────────────────────────────────────────────────────────────

class RiskLevel(str, Enum):
    SAFE = "SAFE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RedFlagCategory(str, Enum):
    URGENCY = "URGENCY"
    DOMAIN_SPOOFING = "DOMAIN_SPOOFING"
    SUSPICIOUS_LINKS = "SUSPICIOUS_LINKS"
    CREDENTIAL_HARVESTING = "CREDENTIAL_HARVESTING"
    IMPERSONATION = "IMPERSONATION"
    MALWARE = "MALWARE"
    SOCIAL_ENGINEERING = "SOCIAL_ENGINEERING"
    TECHNICAL = "TECHNICAL"
    HEADER_ANOMALY = "HEADER_ANOMALY"
    OTHER = "OTHER"


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AnalysisConfidence(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class EmailType(str, Enum):
    PHISHING = "PHISHING"
    SPEAR_PHISHING = "SPEAR_PHISHING"
    VISHING = "VISHING"
    SMISHING = "SMISHING"
    LEGITIMATE = "LEGITIMATE"
    SPAM = "SPAM"
    UNKNOWN = "UNKNOWN"


# ── Nested Models ─────────────────────────────────────────────────────────────

class RedFlag(BaseModel):
    """A single identified threat indicator."""
    category: RedFlagCategory
    severity: Severity
    title: str = Field(max_length=120)
    description: str = Field(max_length=600)
    # Specific excerpt from the email that triggered this flag (for explainability)
    evidence: str = Field(max_length=400)


class ActionableAdvice(BaseModel):
    """Concrete steps tailored to the analysis result."""
    immediate_actions: List[str] = Field(description="Things to do right now")
    do_not: List[str] = Field(description="Things NOT to do")
    report_to: List[str] = Field(description="Entities to report to if malicious")


# ── Top-Level AI Response ─────────────────────────────────────────────────────

class AIAnalysisResult(BaseModel):
    """
    Strict representation of the JSON the AI engine must return.
    This is deserialized from the LLM output and re-serialised as the API response.
    """
    risk_score: int = Field(ge=0, le=100, description="Overall phishing risk 0–100")
    risk_level: RiskLevel
    summary: str = Field(
        max_length=800,
        description="Plain-English 2–3 sentence assessment",
    )
    red_flags: List[RedFlag] = Field(default_factory=list)
    legitimate_indicators: List[str] = Field(
        default_factory=list,
        description="Elements that appear genuine",
    )
    actionable_advice: ActionableAdvice
    analysis_confidence: AnalysisConfidence
    email_type: EmailType


# ── API Request / Response ────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    """Request body for POST /api/analysis/analyze."""
    email_text: str = Field(
        min_length=10,
        description="Raw email headers + body, or just the body text",
    )
    label: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Optional user-provided label for this scan",
    )


class AnalyzeResponse(BaseModel):
    """Full response returned to the client after analysis."""
    scan_id: str                   # UUID of the persisted Scan record
    analysis: AIAnalysisResult
    cached: bool = False           # True if result was retrieved from DB cache
