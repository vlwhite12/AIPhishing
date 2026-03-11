/**
 * lib/utils.ts
 * ─────────────
 * Pure utility functions shared across UI components.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RiskLevel, Severity } from "./types";

/** Merge Tailwind class names safely (resolves conflicts). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ── Risk Level Styling ────────────────────────────────────────────────────────

interface RiskStyle {
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  /** 0-100 value used to drive the score arc/bar */
  barColor: string;
}

export const RISK_STYLES: Record<RiskLevel, RiskStyle> = {
  SAFE: {
    label: "Safe",
    textColor: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-300",
    barColor: "#16a34a",
  },
  LOW: {
    label: "Low Risk",
    textColor: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-300",
    barColor: "#ca8a04",
  },
  MEDIUM: {
    label: "Medium Risk",
    textColor: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-300",
    barColor: "#ea580c",
  },
  HIGH: {
    label: "High Risk",
    textColor: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-400",
    barColor: "#dc2626",
  },
  CRITICAL: {
    label: "Critical",
    textColor: "text-red-900",
    bgColor: "bg-red-100",
    borderColor: "border-red-600",
    barColor: "#7f1d1d",
  },
};

export const SEVERITY_STYLES: Record<Severity, { badge: string }> = {
  LOW: { badge: "bg-blue-100 text-blue-800" },
  MEDIUM: { badge: "bg-yellow-100 text-yellow-800" },
  HIGH: { badge: "bg-orange-100 text-orange-800" },
  CRITICAL: { badge: "bg-red-100 text-red-800 font-semibold" },
};

/** Format ISO date string to a human-readable local date-time. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
