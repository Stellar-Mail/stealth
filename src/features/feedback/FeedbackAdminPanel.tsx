/**
 * Admin operations panel for triage, export, and closure of beta feedback
 * reports. Accessible at /admin/feedback in the operations console.
 *
 * Security: all API calls include the x-stealth-address admin header.
 * No plaintext message bodies, tokens, or credential material is displayed
 * (the service never stores them).
 */

import { useState, useEffect, useCallback } from "react";
import {
  Bug,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  ChevronDown,
  ChevronUp,
  Filter,
  Loader2,
} from "lucide-react";

type FeedbackStatus = "open" | "triaged" | "resolved" | "closed" | "wont_fix";
type FeedbackCategory = "bug" | "performance" | "ui" | "security" | "feature_request" | "other";
type FeedbackSeverity = "low" | "medium" | "high" | "critical";

interface FeedbackReport {
  reportId: string;
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  steps: string;
  screenshotConsent: boolean;
  screenshotDataUrl: string | null;
  diagnostics: Record<string, unknown> | null;
  reporterId: string;
  createdAt: string;
  updatedAt: string;
  triageNotes: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

const ADMIN_ADDR = "GADMIN77777777777777777777777777777777777777777777777777";

const STATUS_BADGES: Record<FeedbackStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  triaged: { label: "Triaged", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  closed: { label: "Closed", className: "bg-neutral-800 text-neutral-500 border-neutral-700" },
  wont_fix: { label: "Won't Fix", className: "bg-neutral-800 text-neutral-500 border-neutral-700" },
};

const SEVERITY_BADGES: Record<FeedbackSeverity, string> = {
  low: "text-blue-400",
  medium: "text-yellow-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

export function FeedbackPanel() {
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Triage / close inline state
  const [triagingId, setTriagingId] = useState<string | null>(null);
  const [triageNotes, setTriageNotes] = useState("");
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeStatus, setCloseStatus] = useState<"resolved" | "closed" | "wont_fix">("resolved");
  const [closeReason, setCloseReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/v1/admin/feedback${qs}`, {
        headers: { "x-stealth-address": ADMIN_ADDR },
      });
      if (!res.ok) throw new Error("Failed to fetch feedback reports");
      const json = await res.json();
      setReports(json.data.reports || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleTriage = async (reportId: string) => {
    if (!triageNotes.trim() || triageNotes.length < 4) return;
    setMutating(true);
    setMutationError(null);
    try {
      const res = await fetch(`/api/v1/admin/feedback/${reportId}/triage`, {
        method: "POST",
        headers: {
          "x-stealth-address": ADMIN_ADDR,
          "content-type": "application/json",
        },
        body: JSON.stringify({ triageNotes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Triage failed");
      setTriagingId(null);
      setTriageNotes("");
      fetchReports();
    } catch (e: any) {
      setMutationError(e.message);
    } finally {
      setMutating(false);
    }
  };

  const handleClose = async (reportId: string) => {
    if (!closeReason.trim() || closeReason.length < 4) return;
    setMutating(true);
    setMutationError(null);
    try {
      const res = await fetch(`/api/v1/admin/feedback/${reportId}/close`, {
        method: "POST",
        headers: {
          "x-stealth-address": ADMIN_ADDR,
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: closeStatus, reason: closeReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Close failed");
      setClosingId(null);
      setCloseReason("");
      fetchReports();
    } catch (e: any) {
      setMutationError(e.message);
    } finally {
      setMutating(false);
    }
  };

  const handleExport = () => {
    const ndjson = reports
      .map((r) =>
        JSON.stringify({
          ...r,
          // Ensure no secret material leaks via the export — screenshots
          // are already sanitised server-side; we strip the data URL client-side too.
          screenshotDataUrl: r.screenshotDataUrl ? "[SCREENSHOT_PRESENT]" : null,
        }),
      )
      .join("\n");
    const blob = new Blob([ndjson], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feedback-export-${new Date().toISOString().slice(0, 10)}.ndjson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Beta Feedback Reports</h2>
          <p className="text-neutral-400 text-sm mt-1">
            Triage, export, and close defect reports from beta testers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="feedback-admin-export"
            onClick={handleExport}
            disabled={reports.length === 0}
            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-100 transition-all flex items-center gap-1.5 text-xs disabled:opacity-40"
          >
            <Download className="size-3.5" />
            Export NDJSON
          </button>
          <button
            id="feedback-admin-refresh"
            onClick={fetchReports}
            className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-100 transition-all"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <Filter className="size-3.5 text-neutral-500" />
        <div className="flex gap-1.5">
          {(["", "open", "triaged", "resolved", "closed", "wont_fix"] as const).map((s) => (
            <button
              key={s}
              id={`feedback-filter-${s || "all"}`}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs rounded-full border transition-all ${
                statusFilter === s
                  ? "border-purple-500/60 bg-purple-500/10 text-purple-300"
                  : "border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
              }`}
            >
              {s === "" ? "All" : (STATUS_BADGES[s as FeedbackStatus]?.label ?? s)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Report list */}
      <div className="border border-neutral-800 bg-neutral-900/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-500">
            No feedback reports found.
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {reports.map((report) => {
              const isExpanded = expandedId === report.reportId;
              const isTriaging = triagingId === report.reportId;
              const isClosing = closingId === report.reportId;
              const badge = STATUS_BADGES[report.status];

              return (
                <div key={report.reportId} className="hover:bg-neutral-900/20 transition-colors">
                  {/* Summary row */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : report.reportId)}
                  >
                    <Bug className="size-4 text-neutral-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        <span
                          className={`text-xs font-medium capitalize ${SEVERITY_BADGES[report.severity]}`}
                        >
                          {report.severity}
                        </span>
                        <span className="text-xs text-neutral-400 capitalize">
                          {report.category.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5 truncate">
                        {report.steps.slice(0, 100)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-neutral-500 font-mono">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="size-3.5 text-neutral-500 ml-auto mt-1" />
                      ) : (
                        <ChevronDown className="size-3.5 text-neutral-500 ml-auto mt-1" />
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-neutral-800/60">
                      <div className="grid grid-cols-2 gap-3 pt-3">
                        <div className="bg-neutral-950 rounded-lg p-3">
                          <div className="text-[11px] text-neutral-500 mb-1">Report ID</div>
                          <div className="text-xs font-mono text-neutral-300 break-all">
                            {report.reportId}
                          </div>
                        </div>
                        <div className="bg-neutral-950 rounded-lg p-3">
                          <div className="text-[11px] text-neutral-500 mb-1">Reporter token</div>
                          <div className="text-xs font-mono text-neutral-300 truncate">
                            {report.reporterId}
                          </div>
                        </div>
                      </div>

                      <div className="bg-neutral-950 rounded-lg p-3">
                        <div className="text-[11px] text-neutral-500 mb-1">Steps (redacted)</div>
                        <div className="text-xs text-neutral-300 whitespace-pre-wrap">
                          {report.steps}
                        </div>
                      </div>

                      {report.diagnostics && (
                        <div className="bg-neutral-950 rounded-lg p-3">
                          <div className="text-[11px] text-neutral-500 mb-1">Diagnostics</div>
                          <pre className="text-[11px] text-neutral-400 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(report.diagnostics, null, 2)}
                          </pre>
                        </div>
                      )}

                      {report.triageNotes && (
                        <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-lg p-3">
                          <div className="text-[11px] text-yellow-500 mb-1">Triage notes</div>
                          <div className="text-xs text-yellow-200/80">{report.triageNotes}</div>
                        </div>
                      )}

                      {mutationError && (
                        <div className="flex items-center gap-1.5 text-xs text-red-400">
                          <AlertTriangle className="size-3.5" />
                          {mutationError}
                        </div>
                      )}

                      {/* Actions */}
                      {report.status === "open" && !isTriaging && !isClosing && (
                        <div className="flex gap-2">
                          <button
                            id={`feedback-triage-${report.reportId}`}
                            onClick={() => setTriagingId(report.reportId)}
                            className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded-lg text-xs transition-all flex items-center gap-1.5"
                          >
                            <Clock className="size-3.5" />
                            Triage
                          </button>
                          <button
                            id={`feedback-close-${report.reportId}`}
                            onClick={() => setClosingId(report.reportId)}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700 rounded-lg text-xs transition-all flex items-center gap-1.5"
                          >
                            <XCircle className="size-3.5" />
                            Close
                          </button>
                        </div>
                      )}

                      {report.status === "triaged" && !isClosing && (
                        <button
                          id={`feedback-resolve-${report.reportId}`}
                          onClick={() => {
                            setClosingId(report.reportId);
                            setCloseStatus("resolved");
                          }}
                          className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs transition-all flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="size-3.5" />
                          Mark resolved
                        </button>
                      )}

                      {/* Triage form */}
                      {isTriaging && (
                        <div className="space-y-2">
                          <textarea
                            id={`feedback-triage-notes-${report.reportId}`}
                            value={triageNotes}
                            onChange={(e) => setTriageNotes(e.target.value)}
                            placeholder="Add triage notes (min 4 characters)..."
                            rows={3}
                            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              id={`feedback-triage-confirm-${report.reportId}`}
                              onClick={() => handleTriage(report.reportId)}
                              disabled={triageNotes.length < 4 || mutating}
                              className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white rounded-lg text-xs flex items-center gap-1.5 transition-all"
                            >
                              {mutating ? <Loader2 className="size-3 animate-spin" /> : null}
                              Confirm triage
                            </button>
                            <button
                              onClick={() => {
                                setTriagingId(null);
                                setTriageNotes("");
                              }}
                              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-lg text-xs transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Close form */}
                      {isClosing && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            {(["resolved", "closed", "wont_fix"] as const).map((s) => (
                              <button
                                key={s}
                                id={`feedback-close-status-${s}`}
                                onClick={() => setCloseStatus(s)}
                                className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                                  closeStatus === s
                                    ? "border-purple-500/60 bg-purple-500/10 text-purple-300"
                                    : "border-neutral-800 text-neutral-500"
                                }`}
                              >
                                {s.replace("_", " ")}
                              </button>
                            ))}
                          </div>
                          <input
                            id={`feedback-close-reason-${report.reportId}`}
                            type="text"
                            value={closeReason}
                            onChange={(e) => setCloseReason(e.target.value)}
                            placeholder="Reason for closing (min 4 chars)"
                            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              id={`feedback-close-confirm-${report.reportId}`}
                              onClick={() => handleClose(report.reportId)}
                              disabled={closeReason.length < 4 || mutating}
                              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 rounded-lg text-xs flex items-center gap-1.5 transition-all"
                            >
                              {mutating ? <Loader2 className="size-3 animate-spin" /> : null}
                              Confirm close
                            </button>
                            <button
                              onClick={() => {
                                setClosingId(null);
                                setCloseReason("");
                              }}
                              className="px-3 py-1.5 bg-neutral-900 text-neutral-500 rounded-lg text-xs transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
