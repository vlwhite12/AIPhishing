"use client";

/**
 * components/results/ResultsPanel.tsx
 * ──────────────────────────────────────
 * Visually rich results panel that displays the AI phishing analysis.
 *
 * Layout:
 *  1. Risk Score arc meter (colour-coded green → red)
 *  2. Summary card
 *  3. Red Flags grid (each flag shows category badge, severity, evidence)
 *  4. Legitimate Indicators (collapsed if empty)
 *  5. Actionable Advice (3-column: Do This / Don't Do This / Report To)
 *  6. Metadata footer (email type, confidence, scan ID)
 */
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Flag,
  Info,
  Link2Off,
  Mail,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import type {
  AIAnalysisResult,
  AnalyzeResponse,
  RedFlag,
  RedFlagCategory,
} from "@/lib/types";
import { cn, formatDate, RISK_STYLES, SEVERITY_STYLES } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Circular arc meter showing the risk score 0–100 */
function RiskScoreMeter({ score, level }: { score: number; level: string }) {
  const style = RISK_STYLES[level as keyof typeof RISK_STYLES] ?? RISK_STYLES.MEDIUM;

  // SVG arc calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          {/* Background track */}
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth="12"
          />
          {/* Score arc */}
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke={style.barColor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Score number overlaid */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-white">{score}</span>
          <span className="text-xs text-slate-400 uppercase tracking-wider">/ 100</span>
        </div>
      </div>
      {/* Risk Level Badge */}
      <span
        className={cn(
          "px-4 py-1 rounded-full text-sm font-semibold border",
          style.textColor,
          style.bgColor,
          style.borderColor
        )}
      >
        {style.label}
      </span>
    </div>
  );
}

/** Maps a RedFlagCategory to an icon */
function categoryIcon(category: RedFlagCategory) {
  const iconClass = "h-4 w-4 flex-shrink-0";
  const map: Record<RedFlagCategory, React.ReactNode> = {
    URGENCY: <AlertTriangle className={iconClass} />,
    DOMAIN_SPOOFING: <Link2Off className={iconClass} />,
    SUSPICIOUS_LINKS: <Link2Off className={iconClass} />,
    CREDENTIAL_HARVESTING: <ShieldAlert className={iconClass} />,
    IMPERSONATION: <Flag className={iconClass} />,
    MALWARE: <XCircle className={iconClass} />,
    SOCIAL_ENGINEERING: <AlertTriangle className={iconClass} />,
    TECHNICAL: <Info className={iconClass} />,
    HEADER_ANOMALY: <Mail className={iconClass} />,
    OTHER: <Flag className={iconClass} />,
  };
  return map[category] ?? <Flag className={iconClass} />;
}

/** Formats the category enum into a readable label */
function formatCategory(cat: RedFlagCategory): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A single red flag card */
function RedFlagCard({ flag }: { flag: RedFlag }) {
  const [expanded, setExpanded] = useState(false);
  const severityStyle = SEVERITY_STYLES[flag.severity];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-750 transition-colors"
      >
        <span className="text-slate-400 mt-0.5">{categoryIcon(flag.category)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{flag.title}</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide",
                severityStyle.badge
              )}
            >
              {flag.severity}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-slate-500 border border-slate-600 px-2 py-0.5 rounded-full">
              {formatCategory(flag.category)}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{flag.description}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
        )}
      </button>

      {/* Expanded evidence */}
      {expanded && (
        <div className="border-t border-slate-700 px-4 pb-4 pt-3 space-y-3">
          <p className="text-sm text-slate-300">{flag.description}</p>
          {flag.evidence && (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
                Evidence
              </p>
              <p className="text-sm font-mono text-amber-300 break-all">{flag.evidence}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Results Panel
// ─────────────────────────────────────────────────────────────────────────────

interface ResultsPanelProps {
  result: AnalyzeResponse;
  onReset: () => void;
}

export default function ResultsPanel({ result, onReset }: ResultsPanelProps) {
  const { scan_id, analysis } = result;
  const {
    risk_score,
    risk_level,
    summary,
    red_flags,
    legitimate_indicators,
    actionable_advice,
    analysis_confidence,
    email_type,
  } = analysis;

  const hasRedFlags = red_flags.length > 0;
  const hasLegitimate = legitimate_indicators.length > 0;
  const isSafe = risk_level === "SAFE" || risk_level === "LOW";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Hero: Score + Summary ──────────────────────────────────────── */}
      <div
        className={cn(
          "bg-slate-900 border rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-center",
          isSafe ? "border-green-800" : "border-red-800"
        )}
      >
        <RiskScoreMeter score={risk_score} level={risk_level} />

        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            {isSafe ? (
              <ShieldCheck className="h-5 w-5 text-green-500" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-red-500" />
            )}
            <h2 className="text-lg font-bold text-white">
              {isSafe ? "This email appears safe" : "Phishing indicators detected"}
            </h2>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">{summary}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <MetaBadge label="Email Type" value={email_type.replace(/_/g, " ")} />
            <MetaBadge label="Confidence" value={analysis_confidence} />
            <MetaBadge label="Flags Found" value={String(red_flags.length)} />
          </div>
        </div>
      </div>

      {/* ── Red Flags ─────────────────────────────────────────────────── */}
      {hasRedFlags && (
        <section>
          <SectionHeading
            icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
            title="Red Flags"
            subtitle={`${red_flags.length} indicator${red_flags.length !== 1 ? "s" : ""} found`}
          />
          <div className="space-y-3">
            {red_flags.map((flag, i) => (
              <RedFlagCard key={i} flag={flag} />
            ))}
          </div>
        </section>
      )}

      {/* ── Legitimate Indicators ─────────────────────────────────────── */}
      {hasLegitimate && (
        <section>
          <SectionHeading
            icon={<CheckCircle2 className="h-4 w-4 text-green-400" />}
            title="Legitimate Indicators"
            subtitle="Things that appear genuine"
          />
          <ul className="space-y-2">
            {legitimate_indicators.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 bg-slate-900 border border-slate-700 rounded-lg p-3"
              >
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-300">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Actionable Advice ──────────────────────────────────────────── */}
      <section>
        <SectionHeading
          icon={<ClipboardList className="h-4 w-4 text-blue-400" />}
          title="What To Do Next"
          subtitle="Recommended actions based on this analysis"
        />
        <div className="grid sm:grid-cols-3 gap-4">
          {/* Do This */}
          <AdviceCard
            title="Do This Now"
            color="blue"
            items={actionable_advice.immediate_actions}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          {/* Don't Do This */}
          <AdviceCard
            title="Do NOT"
            color="red"
            items={actionable_advice.do_not}
            icon={<XCircle className="h-4 w-4" />}
          />
          {/* Report To */}
          <AdviceCard
            title="Report To"
            color="amber"
            items={actionable_advice.report_to}
            icon={<Flag className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <p className="text-xs text-slate-600 font-mono">Scan ID: {scan_id}</p>
        <button
          onClick={onReset}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
        >
          Analyse another email →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable pieces
// ─────────────────────────────────────────────────────────────────────────────

function MetaBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="bg-slate-800 border border-slate-700 rounded-full px-3 py-1 text-slate-400">
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-300 font-medium">{value}</span>
    </span>
  );
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {subtitle && <span className="text-xs text-slate-500">({subtitle})</span>}
    </div>
  );
}

type AdviceColor = "blue" | "red" | "amber";

const ADVICE_COLOR_MAP: Record<AdviceColor, { header: string; item: string; icon: string }> = {
  blue: {
    header: "bg-blue-900/40 border-blue-800",
    item: "text-blue-300",
    icon: "text-blue-400",
  },
  red: {
    header: "bg-red-900/40 border-red-800",
    item: "text-red-300",
    icon: "text-red-400",
  },
  amber: {
    header: "bg-amber-900/30 border-amber-800",
    item: "text-amber-300",
    icon: "text-amber-400",
  },
};

function AdviceCard({
  title,
  color,
  items,
  icon,
}: {
  title: string;
  color: AdviceColor;
  items: string[];
  icon: React.ReactNode;
}) {
  const colors = ADVICE_COLOR_MAP[color];
  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3",
        colors.header
      )}
    >
      <div className={cn("flex items-center gap-2 font-semibold text-sm", colors.icon)}>
        {icon}
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500 italic">None</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className={cn("text-xs leading-relaxed flex items-start gap-1.5", colors.item)}>
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-current flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
