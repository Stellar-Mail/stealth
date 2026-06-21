import React, { useState } from "react";
import { useMultiAgentAssignment } from "../hooks/use-multi-agent-assignment";
import { AgentList } from "./AgentList";
import { ThreadList } from "./ThreadList";

export function AssignmentConsole() {
  const {
    agents,
    threads,
    logs,
    metrics,
    assignAgent,
    unassignAgent,
    updateAgentStatus,
    resolveThread,
    autoAssign,
    autoAssignAllUnassigned,
    simulateIncomingThread,
  } = useMultiAgentAssignment();

  // Custom Simulator state
  const [subject, setSubject] = useState("");
  const [snippet, setSnippet] = useState("");
  const [sender, setSender] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [category, setCategory] = useState("General");
  const [showSimulator, setShowSimulator] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simSuccess, setSimSuccess] = useState<string | null>(null);

  // Email presets
  const presets = [
    {
      subject: "Stellar Asset Issuance Error",
      snippet:
        "Unable to complete asset trustline creation on the testnet node. The transaction failed with code op_no_trust.",
      sender: "dev-team@stellar-partner.org",
      priority: "high" as const,
      category: "Stellar",
    },
    {
      subject: "Suspicious API access token rotation failure",
      snippet:
        "Rotator service failed to deploy new keys for client gateway. Older key might be compromised.",
      sender: "sec-ops@stealth.io",
      priority: "high" as const,
      category: "Security",
    },
    {
      subject: "Stellar escrow payment audit request",
      snippet:
        "Looking for verification of transaction signatures of the final lockup escrow payment scheduled for this Friday.",
      sender: "finance@auditors.com",
      priority: "medium" as const,
      category: "Billing",
    },
    {
      subject: "Help: Password reset request token timeout",
      snippet:
        "My password reset link expires in 1 minute, but the email took 5 minutes to arrive. Can you manually send one?",
      sender: "frustrated-user@outlook.com",
      priority: "low" as const,
      category: "General",
    },
  ];

  const handleSimulatePreset = (preset: (typeof presets)[0]) => {
    simulateIncomingThread(
      preset.subject,
      preset.snippet,
      preset.sender,
      preset.priority,
      preset.category,
    );
    setSimSuccess(`Simulated incoming thread: "${preset.subject}"`);
    setTimeout(() => setSimSuccess(null), 3000);
  };

  const handleSimulateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !snippet.trim() || !sender.trim()) {
      setSimError("All simulator fields are required.");
      return;
    }
    simulateIncomingThread(subject, snippet, sender, priority, category);
    setSubject("");
    setSnippet("");
    setSender("");
    setSimError(null);
    setSimSuccess(`Simulated custom thread: "${subject}"`);
    setTimeout(() => setSimSuccess(null), 3000);
  };

  const handleAutoRouteAll = () => {
    const { count, errors } = autoAssignAllUnassigned();
    if (errors.length > 0) {
      setSimError(`Routed ${count} threads, but some failed: ${errors.join(", ")}`);
      setTimeout(() => setSimError(null), 5000);
    } else if (count > 0) {
      setSimSuccess(`Successfully auto-routed ${count} pending threads!`);
      setTimeout(() => setSimSuccess(null), 3000);
    } else {
      setSimSuccess("No pending threads to route.");
      setTimeout(() => setSimSuccess(null), 3000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 bg-zinc-950 text-zinc-100 rounded-3xl border border-zinc-800/80 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Multi-Agent Assignment Console
          </h2>
          <p className="text-sm text-zinc-400 mt-1.5">
            Decentralized workload routing engine. Smart match collaborators based on specialties,
            availability, and balance ratios.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSimulator(!showSimulator)}
            className="px-4 py-2 text-xs font-semibold bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg transition"
          >
            {showSimulator ? "Hide Simulator" : "Show Simulator"}
          </button>
          <button
            onClick={handleAutoRouteAll}
            className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition"
          >
            ⚡ Auto-Route All
          </button>
        </div>
      </div>

      {/* Simulator Panel */}
      {showSimulator && (
        <div className="p-6 border border-zinc-800/60 rounded-2xl bg-zinc-900/20 backdrop-blur-md space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
              Inbox Mail Feed Simulator
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Simulate new support tickets/email threads landing in the team inbox to verify routing
              behavior.
            </p>
          </div>

          {/* Presets */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400">Click a preset mail to inject:</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {presets.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => handleSimulatePreset(preset)}
                  className="p-3 text-left border border-zinc-800/80 bg-zinc-950/40 rounded-xl hover:border-sky-500/30 hover:bg-zinc-900/40 transition group"
                >
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase mb-1">
                    {preset.category}
                  </span>
                  <span className="text-xs font-semibold text-zinc-200 group-hover:text-sky-400 block truncate">
                    {preset.subject}
                  </span>
                  <span className="text-[9px] text-zinc-500 block truncate mt-1">
                    Priority: {preset.priority}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-800/60 pt-4">
            <p className="text-xs font-medium text-zinc-400 mb-3">
              Or create a custom email message:
            </p>
            <form onSubmit={handleSimulateCustom} className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Sender Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. user@stellar.org"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  className="w-full p-2 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Subject Line
                </label>
                <input
                  type="text"
                  placeholder="e.g. API Gateway Timeout"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full p-2 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Category Tag
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                >
                  <option value="General">General</option>
                  <option value="Stellar">Stellar</option>
                  <option value="Security">Security</option>
                  <option value="Billing">Billing</option>
                  <option value="Technical">Technical</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Email Message Excerpt
                </label>
                <input
                  type="text"
                  placeholder="Summarize the issue snippet..."
                  value={snippet}
                  onChange={(e) => setSnippet(e.target.value)}
                  className="w-full p-2 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Priority Tier
                </label>
                <div className="flex gap-2 h-9 items-center">
                  {(["low", "medium", "high"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-1 rounded text-[10px] font-semibold uppercase border transition ${
                        priority === p
                          ? "bg-zinc-800 text-sky-400 border-sky-500/30"
                          : "bg-zinc-950 border-zinc-850 text-zinc-500"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs transition"
                >
                  Simulate Custom Inbound Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simulator feedback banner */}
      {simSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold text-center animate-fade-in">
          {simSuccess}
        </div>
      )}
      {simError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold text-center animate-fade-in">
          {simError}
        </div>
      )}

      {/* Metrics Dashboard */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {/* Metric 1 */}
        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/20 flex flex-col justify-between">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Unassigned Tickets
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span
              className={`text-2xl font-bold font-mono ${
                metrics.unassignedThreads > 0 ? "text-amber-400" : "text-zinc-300"
              }`}
            >
              {metrics.unassignedThreads}
            </span>
            <span className="text-[10px] text-zinc-500">active inbox</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/20 flex flex-col justify-between">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Average Workload
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-mono text-sky-400">
              {metrics.averageWorkload}
            </span>
            <span className="text-[10px] text-zinc-500">threads / agent</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/20 flex flex-col justify-between">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Collaborators
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {metrics.activeAgents}
            </span>
            <span className="text-[10px] text-zinc-500">/ {metrics.totalAgents} online</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/20 flex flex-col justify-between">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Completed/Resolved
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-mono text-purple-400">
              {metrics.resolvedThreads}
            </span>
            <span className="text-[10px] text-zinc-500">threads</span>
          </div>
        </div>
      </div>

      {/* Main workspace layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left/Middle: Ticket Workspace */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
              Mail Queue & Thread Streams ({threads.length})
            </h3>
          </div>
          <ThreadList
            threads={threads}
            agents={agents}
            onAssign={assignAgent}
            onUnassign={unassignAgent}
            onResolve={resolveThread}
            onAutoAssign={autoAssign}
          />
        </div>

        {/* Right Sidebar: Collaborators & Workload Balancing */}
        <div className="space-y-8">
          <AgentList agents={agents} threads={threads} onStatusChange={updateAgentStatus} />

          {/* Audit Trail Logs */}
          <div className="space-y-4 pt-4 border-t border-zinc-800/60">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                Assignment Activity Logs
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono">Real-time audit</span>
            </div>

            <div className="max-h-64 overflow-y-auto border border-zinc-800/80 rounded-xl bg-zinc-950 p-3 space-y-2 scrollbar-thin">
              {logs.length === 0 ? (
                <p className="text-[11px] text-zinc-600 italic text-center py-6">
                  No assignment operations logged yet.
                </p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 border border-zinc-900 rounded bg-zinc-900/10 text-[10px] text-zinc-300 flex flex-col gap-1"
                  >
                    <div className="flex justify-between items-center text-zinc-500">
                      <span className="font-mono">{log.id}</span>
                      <span>
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-semibold text-zinc-200">
                        {log.operator === "Auto-Routing Engine"
                          ? "⚡ Auto-Router"
                          : `👤 ${log.operator}`}
                      </span>
                      <span
                        className={`px-1 rounded text-[8px] uppercase ${
                          log.action === "assigned" || log.action === "auto-routed"
                            ? "bg-emerald-950 text-emerald-400"
                            : "bg-rose-950/60 text-rose-400"
                        }`}
                      >
                        {log.action}
                      </span>
                      {log.agentId !== "all" && (
                        <>
                          <span className="text-zinc-400">collaborator</span>
                          <span className="font-semibold text-sky-400">{log.agentName}</span>
                        </>
                      )}
                    </div>
                    <p className="text-[9px] text-zinc-400 italic truncate">
                      Subject: {log.threadSubject}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default AssignmentConsole;
