import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  FeedbackCategory,
  FeedbackDiagnostics,
  FeedbackSeverity,
  FeedbackStatus,
} from "@/server/api/domain";

interface OperatorFeedbackReport {
  reportId: string;
  reporterReference: string;
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  steps: string;
  diagnosticsConsent: boolean;
  diagnostics: FeedbackDiagnostics | null;
  screenshotConsent: boolean;
  screenshot: { mediaType: string; sizeBytes: number } | null;
  status: FeedbackStatus;
  triageNote: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  closedByReference: string | null;
  version: number;
}

async function apiError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.error?.message || fallback);
}

function statusTone(status: FeedbackStatus): string {
  if (status === "closed") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (status === "triaged") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  return "border-sky-500/20 bg-sky-500/10 text-sky-300";
}

export function FeedbackOperations() {
  const [reports, setReports] = useState<OperatorFeedbackReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | FeedbackStatus>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reason, setReason] = useState("Beta feedback triage");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const endpoint =
    statusFilter === "all"
      ? "/api/v1/admin/feedback"
      : `/api/v1/admin/feedback?status=${encodeURIComponent(statusFilter)}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw await apiError(response, "Could not load feedback reports");
      const body = await response.json();
      setReports(body.data.reports || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load feedback reports");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = async (report: OperatorFeedbackReport, status: FeedbackStatus) => {
    if (reason.trim().length < 4) {
      setError("Enter an operator reason of at least 4 characters");
      return;
    }
    setBusyId(report.reportId);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/feedback/${report.reportId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: report.version,
          reason: reason.trim(),
          status,
          triageNote: notes[report.reportId] ?? report.triageNote,
        }),
      });
      if (!response.ok) throw await apiError(response, "Could not update feedback report");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update feedback report");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const viewScreenshot = async (report: OperatorFeedbackReport) => {
    setBusyId(report.reportId);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/feedback/${report.reportId}/screenshot`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw await apiError(response, "Could not load screenshot");
      const objectUrl = URL.createObjectURL(await response.blob());
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load screenshot");
    } finally {
      setBusyId(null);
    }
  };

  const removeScreenshot = async (report: OperatorFeedbackReport) => {
    if (reason.trim().length < 4) {
      setError("Enter an operator reason before removing evidence");
      return;
    }
    if (
      !window.confirm(
        `Permanently remove the screenshot from ${report.reportId}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyId(report.reportId);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/feedback/${report.reportId}/screenshot`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: report.version, reason: reason.trim() }),
      });
      if (!response.ok) throw await apiError(response, "Could not remove screenshot");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove screenshot");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const downloadExport = async (format: "json" | "csv") => {
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/feedback/export?format=${format}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw await apiError(response, "Could not export feedback reports");
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `feedback-export.${format}`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not export feedback reports");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Beta Feedback Operations</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Triage, export, close, and remove consented screenshot evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void downloadExport("json")}>
            <Download /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => void downloadExport("csv")}>
            <Download /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 md:grid-cols-2">
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-9 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100"
          >
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="triaged">Triaged</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Required operator reason</span>
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
          />
        </label>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"
        >
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
          <Loader2 className="size-4 animate-spin" /> Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 py-16 text-center text-sm text-neutral-500">
          No feedback reports match this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <article
              key={report.reportId}
              className="rounded-xl border border-neutral-800 bg-neutral-900/20 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-sm font-semibold text-neutral-200">
                      {report.reportId}
                    </code>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${statusTone(report.status)}`}
                    >
                      {report.status}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {report.category} · {report.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {report.reporterReference} · {new Date(report.createdAt).toLocaleString()} · v
                    {report.version}
                  </p>
                </div>
                {report.closedAt ? (
                  <CheckCircle2 className="size-5 text-emerald-400" aria-label="Closed" />
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Redacted reproduction steps
                  </h3>
                  <pre className="whitespace-pre-wrap rounded-lg bg-neutral-950 p-3 text-sm text-neutral-300">
                    {report.steps}
                  </pre>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Consented diagnostics
                  </h3>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-950 p-3 text-xs text-neutral-400">
                    {JSON.stringify(report.diagnostics, null, 2)}
                  </pre>
                </div>
              </div>

              <label className="mt-4 block space-y-1 text-xs text-neutral-400">
                <span>Triage note</span>
                <Textarea
                  value={notes[report.reportId] ?? report.triageNote ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [report.reportId]: event.target.value }))
                  }
                  maxLength={1000}
                  rows={2}
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === report.reportId}
                  onClick={() => void mutate(report, "triaged")}
                >
                  <ShieldCheck /> Mark triaged
                </Button>
                {report.status === "closed" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === report.reportId}
                    onClick={() => void mutate(report, "triaged")}
                  >
                    Reopen
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={busyId === report.reportId}
                    onClick={() => void mutate(report, "closed")}
                  >
                    <CheckCircle2 /> Close
                  </Button>
                )}
                {report.screenshot ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === report.reportId}
                      onClick={() => void viewScreenshot(report)}
                    >
                      <Eye /> View screenshot ({Math.ceil(report.screenshot.sizeBytes / 1024)} KiB)
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busyId === report.reportId}
                      onClick={() => void removeScreenshot(report)}
                    >
                      <Trash2 /> Remove screenshot
                    </Button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
