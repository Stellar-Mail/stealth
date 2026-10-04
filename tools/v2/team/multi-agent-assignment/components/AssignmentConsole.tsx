import React, { useState, useEffect } from "react";
import { useMultiAgentAssignment } from "../hooks/use-multi-agent-assignment";
import { AgentList } from "./AgentList";
import { ThreadList } from "./ThreadList";

export function AssignmentConsole() {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitializing(false), 800);
    return () => clearTimeout(timer);
  }, []);

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
    <div
      className="max-w-6xl mx-auto px-4 py-8 space-y-8 bg-surface-panel text-status-neutral rounded-3xl border border-border/80 shadow-2xl backdrop-blur-xl"
      role="main"
      aria-label="Multi-Agent Assignment Console"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-border pb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Multi-Agent Assignment Console
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5" aria-describedby="console-desc">
            <span id="console-desc" className="sr-only">
              Manage and auto-route tickets to the appropriate team members.
            </span>
            Decentralized workload routing engine. Smart match collaborators based on specialties,
            availability, and balance ratios.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSimulator(!showSimulator)}
            aria-expanded={showSimulator}
            aria-controls="simulator-panel"
            className="px-4 py-2 text-xs font-semibold bg-surface-panel border border-border hover:bg-surface-panel focus:outline-none focus:ring-2 focus:ring-sky-500 text-status-neutral rounded-lg transition"
          >
            {showSimulator ? "Hide Simulator" : "Show Simulator"}
          </button>
          <button
            onClick={handleAutoRouteAll}
            aria-label="Automatically route all unassigned tickets"
            className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400 text-white rounded-lg transition"
          >
            ⚡ Auto-Route All
          </button>
        </div>
      </div>

      {isInitializing ? (
        <div
          className="flex flex-col items-center justify-center py-20 space-y-4"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground text-sm font-medium">Loading console state...</p>
        </div>
      ) : (
        <>
          {/* Simulator Panel */}
          {showSimulator && (
            <div
              id="simulator-panel"
              className="p-6 border border-border/60 rounded-2xl bg-surface-panel/20 backdrop-blur-md space-y-6"
            >
              <div>
                <h3 className="text-sm font-semibold text-status-neutral uppercase tracking-wider">
                  Inbox Mail Feed Simulator
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Simulate new support tickets/email threads landing in the team inbox to verify
                  routing behavior.
                </p>
              </div>

              {/* Presets */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Click a preset mail to inject:
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {presets.map((preset, index) => (
                    <button
                      key={index}
                      onClick={() => handleSimulatePreset(preset)}
                      className="p-3 text-left border border-border/80 bg-surface-panel/40 rounded-xl hover:border-sky-500/30 hover:bg-surface-panel/40 transition group"
                    >
                      <span className="text-[10px] font-mono text-muted-foreground block uppercase mb-1">
                        {preset.category}
                      </span>
                      <span className="text-xs font-semibold text-status-neutral group-hover:text-status-info block truncate">
                        {preset.subject}
                      </span>
                      <span className="text-[9px] text-muted-foreground block truncate mt-1">
                        Priority: {preset.priority}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/60 pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  Or create a custom email message:
                </p>
                <form onSubmit={handleSimulateCustom} className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Sender Address
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. user@stellar.org"
                      value={sender}
                      onChange={(e) => setSender(e.target.value)}
                      className="w-full p-2 bg-surface-panel border border-border rounded-lg text-xs text-status-neutral focus:outline-none focus:border-border"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. API Gateway Timeout"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full p-2 bg-surface-panel border border-border rounded-lg text-xs text-status-neutral focus:outline-none focus:border-border"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Category Tag
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full p-2 bg-surface-panel border border-border rounded-lg text-xs text-status-neutral focus:outline-none focus:border-border"
                    >
                      <option value="General">General</option>
                      <option value="Stellar">Stellar</option>
                      <option value="Security">Security</option>
                      <option value="Billing">Billing</option>
                      <option value="Technical">Technical</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Email Message Excerpt
                    </label>
                    <input
                      type="text"
                      placeholder="Summarize the issue snippet..."
                      value={snippet}
                      onChange={(e) => setSnippet(e.target.value)}
                      className="w-full p-2 bg-surface-panel border border-border rounded-lg text-xs text-status-neutral focus:outline-none focus:border-border"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
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
                              ? "bg-surface-panel text-status-info border-sky-500/30"
                              : "bg-surface-panel border-border text-muted-foreground"
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
          <div aria-live="polite" aria-atomic="true">
            {simSuccess && (
              <div className="p-3 mb-4 bg-emerald-500/10 border border-emerald-500/20 text-status-success rounded-xl text-xs font-semibold text-center animate-fade-in">
                {simSuccess}
              </div>
            )}
            {simError && (
              <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/20 text-status-danger rounded-xl text-xs font-semibold text-center animate-fade-in">
                {simError}
              </div>
            )}
          </div>

          {/* Metrics Dashboard */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {/* Metric 1 */}
            <div className="p-4 rounded-xl border border-border/80 bg-surface-panel/20 flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Unassigned Tickets
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span
                  className={`text-2xl font-bold font-mono ${
                    metrics.unassignedThreads > 0 ? "text-status-warning" : "text-status-neutral"
                  }`}
                >
                  {metrics.unassignedThreads}
                </span>
                <span className="text-[10px] text-muted-foreground">active inbox</span>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="p-4 rounded-xl border border-border/80 bg-surface-panel/20 flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Average Workload
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold font-mono text-status-info">
                  {metrics.averageWorkload}
                </span>
                <span className="text-[10px] text-muted-foreground">threads / agent</span>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="p-4 rounded-xl border border-border/80 bg-surface-panel/20 flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Collaborators
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold font-mono text-status-success">
                  {metrics.activeAgents}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  / {metrics.totalAgents} online
                </span>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="p-4 rounded-xl border border-border/80 bg-surface-panel/20 flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Completed/Resolved
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold font-mono text-status-special">
                  {metrics.resolvedThreads}
                </span>
                <span className="text-[10px] text-muted-foreground">threads</span>
              </div>
            </div>
          </div>

          {/* Main workspace layout */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left/Middle: Ticket Workspace */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-status-neutral uppercase tracking-wider">
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
              <div className="space-y-4 pt-4 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-status-neutral uppercase tracking-wider">
                    Assignment Activity Logs
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Real-time audit
                  </span>
                </div>

                <div
                  className="max-h-64 overflow-y-auto border border-border/80 rounded-xl bg-surface-panel p-3 space-y-2 scrollbar-thin"
                  role="log"
                  aria-live="polite"
                  aria-label="Activity Logs"
                >
                  {logs.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic text-center py-6">
                      No assignment operations logged yet.
                    </p>
                  ) : (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2 border border-border rounded bg-surface-panel/10 text-[10px] text-status-neutral flex flex-col gap-1"
                      >
                        <div className="flex justify-between items-center text-muted-foreground">
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
                          <span className="font-semibold text-status-neutral">
                            {log.operator === "Auto-Routing Engine"
                              ? "⚡ Auto-Router"
                              : `👤 ${log.operator}`}
                          </span>
                          <span
                            className={`px-1 rounded text-[8px] uppercase ${
                              log.action === "assigned" || log.action === "auto-routed"
                                ? "bg-emerald-950 text-status-success"
                                : "bg-rose-950/60 text-status-danger"
                            }`}
                          >
                            {log.action}
                          </span>
                          {log.agentId !== "all" && (
                            <>
                              <span className="text-muted-foreground">collaborator</span>
                              <span className="font-semibold text-status-info">
                                {log.agentName}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-[9px] text-muted-foreground italic truncate">
                          Subject: {log.threadSubject}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
export default AssignmentConsole;
