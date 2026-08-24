import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  RefreshCw,
  Play,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/admin/dlq")({
  component: AdminDlqControl,
});

interface DeadLetter {
  deadLetterId: string;
  jobId: string;
  jobType: string;
  status: "failed" | "retried" | "abandoned";
  attempts: number;
  maxAttempts: number;
  payload: any;
  error?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

function AdminDlqControl() {
  const [dlq, setDlq] = useState<DeadLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<DeadLetter | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Mutation states
  const [reason, setReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [mutating, setMutating] = useState(false);
  const [mutationAction, setMutationAction] = useState<"retry" | "abandon" | null>(null);

  const adminAddress = "GADMIN777777777777777777777777777777777777777777777777777777";

  const fetchDlq = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      let query = "?limit=50";
      if (jobTypeFilter) query += `&jobType=${jobTypeFilter}`;
      if (statusFilter) query += `&status=${statusFilter}`;

      const res = await fetch(`/api/v1/admin/dlq${query}`, {
        headers: { "x-stealth-address": adminAddress },
      });
      if (!res.ok) throw new Error("Failed to fetch DLQ records");
      const json = await res.json();
      setDlq(json.data.deadLetters || []);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDlq();
  }, [jobTypeFilter, statusFilter]);

  const handleMutation = async (action: "retry" | "abandon") => {
    if (!selectedItem) return;
    if (!reason.trim()) {
      alert("A reason must be provided.");
      return;
    }

    try {
      setMutating(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const endpoint = `/api/v1/admin/dlq/${selectedItem.deadLetterId}/${action}`;
      const payload: any = { reason: reason.trim() };
      if (action === "abandon" && adminNotes.trim()) {
        payload.adminNotes = adminNotes.trim();
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-stealth-address": adminAddress,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || `Failed to ${action} DLQ item`);

      setSuccessMsg(
        `Dead letter action "${action}" completed. Support ID: ${json.data.supportId || "N/A"}`,
      );
      setReason("");
      setAdminNotes("");
      setMutationAction(null);
      setSelectedItem(null);
      fetchDlq();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setMutating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dead Letter Queue (DLQ)</h2>
          <p className="text-neutral-400 text-sm">
            Monitor failed asynchronous jobs, inspect payloads/traces, and trigger retries.
          </p>
        </div>
        <button
          onClick={fetchDlq}
          className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-100 transition-all flex items-center gap-2 text-xs"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle className="size-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filters & Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Filter Bar + Table List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-4 bg-neutral-900/10 p-4 border border-neutral-800 rounded-2xl">
            <div className="flex-1">
              <label className="block text-[10px] text-neutral-500 font-bold uppercase mb-1">
                Filter Job Type
              </label>
              <select
                value={jobTypeFilter}
                onChange={(e) => setJobTypeFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-850 rounded-lg text-xs focus:outline-none focus:border-purple-500 text-neutral-300"
              >
                <option value="">All Job Types</option>
                <option value="funding">Funding Operations</option>
                <option value="delivery">Message Deliveries</option>
                <option value="anchoring">State Anchoring</option>
                <option value="reconciliation">Reconciliation</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-neutral-500 font-bold uppercase mb-1">
                Filter Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-850 rounded-lg text-xs focus:outline-none focus:border-purple-500 text-neutral-300"
              >
                <option value="">All Statuses</option>
                <option value="failed">Failed (Pending Triage)</option>
                <option value="retried">Retried</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>
          </div>

          <div className="border border-neutral-800 bg-neutral-900/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-xs text-neutral-500">Loading DLQ logs...</div>
              ) : dlq.length === 0 ? (
                <div className="p-12 text-center text-xs text-neutral-500">
                  No dead letter records found.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-500 bg-neutral-900/10 font-bold uppercase text-[10px] tracking-wider">
                      <th className="p-4">Job Type</th>
                      <th className="p-4">DLQ Status</th>
                      <th className="p-4">Failed Error</th>
                      <th className="p-4">Attempts</th>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4 text-center">Triage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dlq.map((item) => (
                      <tr
                        key={item.deadLetterId}
                        className={`border-b border-neutral-800/60 hover:bg-neutral-900/20 cursor-pointer transition-all ${selectedItem?.deadLetterId === item.deadLetterId ? "bg-neutral-900/40" : ""}`}
                        onClick={() => {
                          setSelectedItem(item);
                          setMutationAction(null);
                        }}
                      >
                        <td className="p-4 font-mono font-semibold capitalize text-neutral-200">
                          {item.jobType}
                        </td>
                        <td className="p-4">
                          {item.status === "failed" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">
                              Failed
                            </span>
                          ) : item.status === "retried" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Retried
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-800 text-neutral-500 border border-neutral-700">
                              Abandoned
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-neutral-400 max-w-[180px] truncate">
                          {item.error || "Unknown Failure"}
                        </td>
                        <td className="p-4 text-neutral-400">
                          {item.attempts} / {item.maxAttempts}
                        </td>
                        <td className="p-4 text-neutral-500">
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="p-4 text-center">
                          <ChevronRight className="size-4 mx-auto text-neutral-600" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: DLQ Inspect View & Operations */}
        <div className="border border-neutral-800 bg-neutral-900/10 rounded-2xl p-6 h-fit space-y-6">
          <h3 className="font-bold text-md flex items-center gap-2">
            <Eye className="size-4 text-purple-400" />
            <span>Triage & Inspection</span>
          </h3>

          {selectedItem ? (
            <div className="space-y-6">
              {/* Item Details */}
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block mb-1">
                    Dead Letter ID
                  </span>
                  <span className="font-mono text-xs text-neutral-300 select-all block break-all">
                    {selectedItem.deadLetterId}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block mb-1">
                    Error Message
                  </span>
                  <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-xl font-mono text-xs text-red-400 break-words max-h-40 overflow-y-auto">
                    {selectedItem.error || "No error trace captured."}
                  </div>
                </div>
                {selectedItem.adminNotes && (
                  <div>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block mb-1">
                      Operator Notes
                    </span>
                    <p className="text-xs text-neutral-350 bg-neutral-900/40 p-2.5 rounded-lg border border-neutral-800">
                      {selectedItem.adminNotes}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block mb-1">
                    Payload Metadata
                  </span>
                  <pre className="p-3 bg-neutral-950 border border-neutral-850 rounded-xl font-mono text-[10px] text-neutral-400 overflow-x-auto max-h-40">
                    {JSON.stringify(selectedItem.payload, null, 2)}
                  </pre>
                </div>
              </div>

              <hr className="border-neutral-800" />

              {/* Triage Mutations Console */}
              {selectedItem.status === "failed" &&
                (mutationAction ? (
                  <div className="space-y-4">
                    <span className="text-xs font-semibold text-neutral-300 capitalize">
                      Action: {mutationAction} DLQ Job
                    </span>
                    <input
                      type="text"
                      placeholder="Audit Reason (mandatory)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-3 py-1.5 bg-neutral-905 border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-purple-500"
                      required
                    />
                    {mutationAction === "abandon" && (
                      <textarea
                        placeholder="Optional details / operator notes for this abandonment"
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        className="w-full p-2.5 bg-neutral-905 border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-purple-500"
                        rows={2}
                      />
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMutation(mutationAction)}
                        disabled={mutating}
                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        {mutating ? "Executing..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => {
                          setMutationAction(null);
                          setReason("");
                          setAdminNotes("");
                        }}
                        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-lg text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setMutationAction("retry")}
                      className="flex-1 py-2 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 rounded-xl text-xs font-semibold border border-purple-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="size-3.5" />
                      <span>Retry Job</span>
                    </button>
                    <button
                      onClick={() => setMutationAction("abandon")}
                      className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold border border-red-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ShieldAlert className="size-3.5" />
                      <span>Abandon</span>
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center text-xs text-neutral-500 py-12">
              Select an item from the DLQ list to inspect payload and perform operations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
