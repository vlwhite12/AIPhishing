"use client";

/**
 * app/history/[id]/page.tsx
 * ──────────────────────────
 * Individual scan detail page — deep-linkable by scan UUID.
 *
 * Fetches the full ScanDetail from GET /api/history/:id and renders
 * the same ResultsPanel used on the dashboard, supplementing it with
 * the original email text (collapsible) and scan metadata.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
} from "lucide-react";

import Navbar from "@/components/layout/Navbar";
import ResultsPanel from "@/components/results/ResultsPanel";
import { historyApi, extractErrorMessage } from "@/lib/api";
import type { ScanDetail, AnalyzeResponse } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function ScanDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    historyApi
      .get(params.id)
      .then((data) => {
        setScan(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(extractErrorMessage(err));
        setLoading(false);
      });
  }, [params.id]);

  // Build an AnalyzeResponse shape so ResultsPanel can be reused as-is
  const analyzeResponse: AnalyzeResponse | null =
    scan?.result_json
      ? { scan_id: scan.id, analysis: scan.result_json, cached: true }
      : null;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => router.push("/history")}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to history
        </button>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading scan…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-950 border border-red-700 rounded-xl p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-300">Failed to load scan</p>
              <p className="text-sm text-red-400 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && scan && (
          <div className="space-y-6">
            {/* Scan Metadata Header */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-lg font-bold text-white">
                    {scan.label ?? "Unlabelled Scan"}
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Analysed on {formatDate(scan.created_at)}
                    {scan.completed_at && (
                      <> · Completed {formatDate(scan.completed_at)}</>
                    )}
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-600 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                  {scan.id}
                </span>
              </div>
            </div>

            {/* Failed scan message */}
            {scan.status === "failed" && (
              <div className="bg-red-950 border border-red-800 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-300">Analysis failed</p>
                  <p className="text-sm text-red-400 mt-1">
                    {scan.error_message ?? "An unknown error occurred during analysis."}
                  </p>
                </div>
              </div>
            )}

            {/* Collapsible Original Email */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-800 transition-colors"
              >
                <span className="text-sm font-medium text-slate-300">
                  Original Email Text
                </span>
                {showRaw ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </button>
              {showRaw && (
                <div className="border-t border-slate-700 p-5">
                  <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap break-all leading-relaxed max-h-80 overflow-y-auto">
                    {scan.email_input}
                  </pre>
                </div>
              )}
            </div>

            {/* Results Panel (reused from dashboard) */}
            {analyzeResponse ? (
              <ResultsPanel
                result={analyzeResponse}
                onReset={() => router.push("/dashboard")}
              />
            ) : (
              scan.status !== "failed" && (
                <p className="text-center text-slate-500 py-8">
                  No analysis result available.
                </p>
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}
