"use client";

/**
 * app/history/page.tsx
 * ─────────────────────
 * Paginated scan history table.
 *
 * Features:
 *  - Fetches the user's scan history from GET /api/history
 *  - Sortable columns: Date, Risk Score, Status
 *  - Risk level colour-coded badge
 *  - Click a row to navigate to the full scan detail page
 *  - Delete a scan with a confirmation prompt (no extra modal needed)
 *  - Pagination controls (prev / next)
 */
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ScanSearch,
  Trash2,
} from "lucide-react";

import Navbar from "@/components/layout/Navbar";
import { historyApi, extractErrorMessage } from "@/lib/api";
import type { ScanSummary, ScanListResponse } from "@/lib/types";
import { cn, formatDate, RISK_STYLES } from "@/lib/utils";

const PAGE_SIZE = 15;

export default function HistoryPage() {
  const router = useRouter();
  const [data, setData] = useState<ScanListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await historyApi.list(p, PAGE_SIZE);
      setData(result);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(page);
  }, [page, fetchPage]);

  const handleDelete = async (e: React.MouseEvent, scanId: string) => {
    e.stopPropagation(); // prevent row click navigation
    if (!confirm("Permanently delete this scan? This cannot be undone.")) return;

    setDeletingId(scanId);
    try {
      await historyApi.delete(scanId);
      // Refresh current page; go to previous page if it's now empty
      const newTotal = (data?.total ?? 1) - 1;
      const maxPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      const targetPage = Math.min(page, maxPage);
      if (targetPage !== page) {
        setPage(targetPage);
      } else {
        fetchPage(page);
      }
    } catch (err) {
      alert(extractErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Scan History</h1>
          <p className="text-sm text-slate-400 mt-1">
            All your previous email analyses. Click a row to view the full report.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading history…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-950 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && data?.items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-600 gap-4">
            <ScanSearch className="h-12 w-12" />
            <div className="text-center">
              <p className="font-medium text-slate-400">No scans yet</p>
              <p className="text-sm mt-1">
                Head to the{" "}
                <button
                  onClick={() => router.push("/dashboard")}
                  className="text-blue-400 hover:underline"
                >
                  dashboard
                </button>{" "}
                to analyse your first email.
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && !error && data && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-700 text-left">
                    <th className="px-4 py-3 font-medium text-slate-400 w-full">
                      Label / Date
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-400 whitespace-nowrap">
                      Risk Score
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-400 whitespace-nowrap">
                      Risk Level
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-400 whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.items.map((scan) => (
                    <ScanRow
                      key={scan.id}
                      scan={scan}
                      isDeleting={deletingId === scan.id}
                      onClick={() => router.push(`/history/${scan.id}`)}
                      onDelete={(e) => handleDelete(e, scan.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-slate-500">
                {data.total} scan{data.total !== 1 ? "s" : ""} total
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-slate-400 px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row Component
// ─────────────────────────────────────────────────────────────────────────────

function ScanRow({
  scan,
  isDeleting,
  onClick,
  onDelete,
}: {
  scan: ScanSummary;
  isDeleting: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const riskStyle =
    scan.risk_level ? RISK_STYLES[scan.risk_level] : null;

  return (
    <tr
      onClick={onClick}
      className="bg-slate-900 hover:bg-slate-800 cursor-pointer transition-colors group"
    >
      {/* Label / Date */}
      <td className="px-4 py-3">
        <div className="font-medium text-slate-200 truncate max-w-xs">
          {scan.label ?? (
            <span className="italic text-slate-500">Unlabelled scan</span>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {formatDate(scan.created_at)}
        </div>
      </td>

      {/* Risk Score */}
      <td className="px-4 py-3 text-center">
        {scan.risk_score !== null ? (
          <span
            className={cn(
              "font-bold text-lg",
              riskStyle?.textColor ?? "text-slate-400"
            )}
          >
            {scan.risk_score}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>

      {/* Risk Level Badge */}
      <td className="px-4 py-3">
        {scan.risk_level && riskStyle ? (
          <span
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border",
              riskStyle.textColor,
              riskStyle.bgColor,
              riskStyle.borderColor
            )}
          >
            {riskStyle.label}
          </span>
        ) : (
          <span className="text-slate-600 text-xs">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={scan.status} />
      </td>

      {/* Delete */}
      <td className="px-4 py-3 text-right">
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950 transition-all disabled:opacity-30"
          aria-label="Delete scan"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-green-900/50 text-green-400 border-green-800",
    failed: "bg-red-900/50 text-red-400 border-red-800",
    processing: "bg-blue-900/50 text-blue-400 border-blue-800",
    pending: "bg-slate-800 text-slate-400 border-slate-700",
  };
  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-full text-xs border capitalize",
        map[status] ?? "bg-slate-800 text-slate-400 border-slate-700"
      )}
    >
      {status}
    </span>
  );
}
