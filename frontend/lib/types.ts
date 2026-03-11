/**
 * lib/types.ts
 * ─────────────
 * Shared TypeScript types mirroring the FastAPI Pydantic schemas.
 * Single source of truth for all API request/response shapes on the frontend.
 */

// ── Enumerations ──────────────────────────────────────────────────────────────

export type RiskLevel = "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RedFlagCategory =
  | "URGENCY"
  | "DOMAIN_SPOOFING"
  | "SUSPICIOUS_LINKS"
  | "CREDENTIAL_HARVESTING"
  | "IMPERSONATION"
  | "MALWARE"
  | "SOCIAL_ENGINEERING"
  | "TECHNICAL"
  | "HEADER_ANOMALY"
  | "OTHER";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AnalysisConfidence = "LOW" | "MEDIUM" | "HIGH";

export type EmailType =
  | "PHISHING"
  | "SPEAR_PHISHING"
  | "VISHING"
  | "SMISHING"
  | "LEGITIMATE"
  | "SPAM"
  | "UNKNOWN";

// ── Analysis Response ─────────────────────────────────────────────────────────

export interface RedFlag {
  category: RedFlagCategory;
  severity: Severity;
  title: string;
  description: string;
  evidence: string;
}

export interface ActionableAdvice {
  immediate_actions: string[];
  do_not: string[];
  report_to: string[];
}

export interface AIAnalysisResult {
  risk_score: number;
  risk_level: RiskLevel;
  summary: string;
  red_flags: RedFlag[];
  legitimate_indicators: string[];
  actionable_advice: ActionableAdvice;
  analysis_confidence: AnalysisConfidence;
  email_type: EmailType;
}

export interface AnalyzeResponse {
  scan_id: string;
  analysis: AIAnalysisResult;
  cached: boolean;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

// ── History ───────────────────────────────────────────────────────────────────

export interface ScanSummary {
  id: string;
  label: string | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
}

export interface ScanDetail extends ScanSummary {
  email_input: string;
  result_json: AIAnalysisResult | null;
  error_message: string | null;
  completed_at: string | null;
}

export interface ScanListResponse {
  items: ScanSummary[];
  total: number;
  page: number;
  page_size: number;
}

// ── API Error ─────────────────────────────────────────────────────────────────

export interface APIError {
  detail: string;
}
