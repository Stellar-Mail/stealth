import React, { useState } from "react";
import { Thread, Agent } from "../types";
import { getThreadRequiredSpecialties } from "../services/assignment.service";

interface ThreadListProps {
  threads: Thread[];
  agents: Agent[];
  onAssign: (threadId: string, agentId: string) => void;
  onUnassign: (threadId: string, agentId: string) => void;
  onResolve: (threadId: string) => void;
  onAutoAssign: (threadId: string) => void;
}

export function ThreadList({
  threads,
  agents,
  onAssign,
  onUnassign,
  onResolve,
  onAutoAssign,
}: ThreadListProps) {
  const [filter, setFilter] = useState<"all" | "unassigned" | "assigned" | "resolved">("all");
  const [search, setSearch] = useState("");
  const [assigningThreadId, setAssigningThreadId] = useState<string | null>(null);

  // Filter and search logic
  const filteredThreads = threads.filter((t) => {
    if (filter === "unassigned" && t.status !== "unassigned") return false;
    if (filter === "assigned" && t.status !== "assigned") return false;
    if (filter === "resolved" && t.status !== "resolved") return false;

    if (search.trim() !== "") {
      const q = search.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.sender.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const activeAgents = agents.filter((a) => a.status === "active");

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch">
        <div className="flex-1 relative">
          <input
            type="text"
            aria-label="Search threads"
            placeholder="Search threads by subject, sender, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-surface-panel border border-border rounded-lg text-status-neutral placeholder-zinc-500 focus:outline-none focus:border-border focus:ring-1 focus:ring-zinc-600"
          />
          <span className="absolute left-3 top-2.5 text-muted-foreground" aria-hidden="true">
            🔍
          </span>
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-2.5 text-[10px] text-muted-foreground hover:text-status-neutral focus:outline-none focus:text-status-neutral"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tab Filters */}
        <div
          className="flex bg-surface-panel p-1 rounded-lg border border-border"
          role="tablist"
          aria-label="Filter threads by status"
        >
          {(["all", "unassigned", "assigned", "resolved"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={filter === t}
              aria-controls="threads-panel"
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${
                filter === t
                  ? "bg-surface-panel text-status-info shadow-sm"
                  : "text-muted-foreground hover:text-status-neutral"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Threads list container */}
      <div id="threads-panel" className="space-y-3" role="list" aria-label="Support threads">
        {filteredThreads.length === 0 ? (
          <div
            className="text-center py-12 border border-dashed border-border rounded-xl bg-surface-panel/5"
            role="status"
            aria-live="polite"
          >
            <span className="text-2xl block mb-2" aria-hidden="true">
              📥
            </span>
            <p className="text-xs text-muted-foreground font-medium">
              {threads.length === 0
                ? "No active threads in the queue."
                : "No matching threads found."}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Try modifying filters or simulating an incoming mail stream.
            </p>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const reqSpecs = getThreadRequiredSpecialties(thread);

            return (
              <div
                key={thread.id}
                role="listitem"
                className={`p-4 rounded-xl border transition-all duration-200 bg-surface-panel/10 ${
                  thread.status === "resolved"
                    ? "border-border/40 opacity-70 bg-surface-panel/20"
                    : thread.status === "assigned"
                      ? "border-border/80 hover:border-border/80"
                      : "border-sky-500/20 shadow-[0_0_12px_rgba(14,165,233,0.03)] hover:border-sky-500/40"
                }`}
              >
                {/* Header: Priority, Category, Date, Status */}
                <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border ${
                        thread.priority === "high"
                          ? "bg-rose-500/10 text-status-danger border-rose-500/20"
                          : thread.priority === "medium"
                            ? "bg-amber-500/10 text-status-warning border-amber-500/20"
                            : "bg-surface-panel/40 text-muted-foreground border-border/50"
                      }`}
                    >
                      {thread.priority} Priority
                    </span>
                    {thread.category && (
                      <span className="px-2 py-0.5 text-[9px] font-semibold bg-surface-panel text-status-neutral rounded-md">
                        {thread.category}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {new Date(thread.date).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Subject & Sender info */}
                <div>
                  <h4 className="text-sm font-semibold text-status-neutral">{thread.subject}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">From: {thread.sender}</p>
                  <p className="text-xs text-status-neutral bg-surface-panel/30 p-2.5 rounded-lg border border-border/50 mt-2 line-clamp-2">
                    {thread.snippet}
                  </p>
                </div>

                {/* Specialties Match Info */}
                {thread.status !== "resolved" && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-3 text-[10px] text-muted-foreground">
                    <span className="text-muted-foreground">Matches tags:</span>
                    {reqSpecs.map((spec) => (
                      <span
                        key={spec}
                        className="px-1.5 py-0.5 rounded bg-sky-950/20 text-status-info border border-sky-500/10 font-mono text-[9px]"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions & Assignments Footer */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-border/60 pt-3 mt-3 gap-3">
                  {/* Current Assignments */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mr-1">
                      Assigned To:
                    </span>
                    {thread.assignedAgentIds.length === 0 ? (
                      <span className="text-[11px] italic text-muted-foreground">None</span>
                    ) : (
                      thread.assignedAgentIds.map((agentId) => {
                        const agent = agents.find((a) => a.id === agentId);
                        if (!agent) return null;
                        return (
                          <span
                            key={agentId}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-panel text-status-neutral border border-border/50 text-[10px] font-medium"
                          >
                            <span>{agent.avatar}</span>
                            <span>{agent.name}</span>
                            {thread.status !== "resolved" && (
                              <button
                                onClick={() => onUnassign(thread.id, agentId)}
                                aria-label={`Unassign ${agent.name}`}
                                className="w-3.5 h-3.5 rounded-full hover:bg-surface-panel focus:outline-none focus:ring-1 focus:ring-rose-500 text-[9px] flex items-center justify-center text-muted-foreground hover:text-status-danger transition"
                                title="Remove Collaborator"
                              >
                                ✕
                              </button>
                            )}
                          </span>
                        );
                      })
                    )}
                  </div>

                  {/* Actions buttons */}
                  {thread.status !== "resolved" && (
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                      {/* Manual assign trigger dropdown */}
                      <div className="relative">
                        <button
                          aria-haspopup="listbox"
                          aria-expanded={assigningThreadId === thread.id}
                          onClick={() =>
                            setAssigningThreadId(assigningThreadId === thread.id ? null : thread.id)
                          }
                          className="px-2.5 py-1.5 text-[10px] font-semibold bg-surface-panel border border-border text-status-neutral hover:text-status-neutral hover:border-border focus:outline-none focus:ring-2 focus:ring-zinc-600 rounded-lg transition"
                        >
                          + Assign Agent
                        </button>
                        {assigningThreadId === thread.id && (
                          <div
                            className="absolute right-0 bottom-full mb-2 w-48 max-h-56 overflow-y-auto bg-surface-panel border border-border rounded-lg shadow-2xl z-20 p-1 space-y-0.5"
                            role="listbox"
                            aria-label="Available agents"
                          >
                            <p className="text-[9px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wide border-b border-border">
                              Active Agents
                            </p>
                            {activeAgents.length === 0 ? (
                              <p
                                className="text-[10px] italic text-muted-foreground p-2"
                                role="alert"
                              >
                                No active agents
                              </p>
                            ) : (
                              activeAgents.map((agent) => {
                                const isAssigned = thread.assignedAgentIds.includes(agent.id);
                                return (
                                  <button
                                    key={agent.id}
                                    role="option"
                                    aria-selected={isAssigned}
                                    disabled={isAssigned}
                                    onClick={() => {
                                      onAssign(thread.id, agent.id);
                                      setAssigningThreadId(null);
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 text-[11px] rounded flex justify-between items-center transition focus:outline-none focus:bg-surface-panel/80 ${
                                      isAssigned
                                        ? "text-muted-foreground cursor-not-allowed bg-surface-panel/10"
                                        : "text-status-neutral hover:bg-surface-panel/80"
                                    }`}
                                  >
                                    <span className="flex items-center gap-1.5 truncate">
                                      <span aria-hidden="true">{agent.avatar}</span>
                                      <span className="truncate">{agent.name}</span>
                                    </span>
                                    <span className="text-[9px] font-mono text-muted-foreground">
                                      L:{agent.workload}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {/* Smart Auto assign button */}
                      <button
                        onClick={() => {
                          try {
                            onAutoAssign(thread.id);
                          } catch (err: unknown) {
                            alert(err instanceof Error ? err.message : String(err));
                          }
                        }}
                        aria-label="Smart auto-route"
                        className="px-2.5 py-1.5 text-[10px] font-semibold bg-sky-950/30 border border-sky-500/20 text-status-info hover:bg-sky-950/60 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-lg transition"
                      >
                        ⚡ Smart Route
                      </button>

                      {/* Resolve button */}
                      <button
                        onClick={() => onResolve(thread.id)}
                        aria-label="Resolve thread"
                        className="px-2.5 py-1.5 text-[10px] font-semibold bg-emerald-950/30 border border-emerald-500/20 text-status-success hover:bg-emerald-950/60 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg transition"
                      >
                        ✓ Resolve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
export default ThreadList;
