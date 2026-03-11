"use client";

/**
 * app/dashboard/page.tsx
 * ────────────────────────
 * The main application page.
 * Orchestrates the analysis flow: form → loading → results.
 *
 * State machine:
 *   idle → submitting (handled inside EmailAnalysisForm) → results
 *   results → idle (user clicks "Analyse another")
 */
import { useState } from "react";

import Navbar from "@/components/layout/Navbar";
import EmailAnalysisForm from "@/components/dashboard/EmailAnalysisForm";
import ResultsPanel from "@/components/results/ResultsPanel";
import type { AnalyzeResponse } from "@/lib/types";

export default function DashboardPage() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        {/* Page header */}
        {!result && (
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold text-white mb-2">
              Is this email a phishing attempt?
            </h1>
            <p className="text-slate-400 max-w-xl mx-auto text-sm">
              Paste the full email — headers and body — below. Our AI will
              analyse it for psychological manipulation, spoofed domains,
              suspicious links, and more.
            </p>
          </div>
        )}

        {/* Conditional render: form or results */}
        {result === null ? (
          <div className="max-w-3xl mx-auto">
            <EmailAnalysisForm onResult={setResult} />
          </div>
        ) : (
          <ResultsPanel result={result} onReset={() => setResult(null)} />
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
        PhishCatch AI – Analysis is AI-assisted; always verify with your IT/security team.
      </footer>
    </div>
  );
}
