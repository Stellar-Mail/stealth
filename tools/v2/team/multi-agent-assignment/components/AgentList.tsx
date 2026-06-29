import React from "react";
import { Agent, Thread } from "../types";

interface AgentListProps {
  agents: Agent[];
  threads: Thread[];
  onStatusChange: (agentId: string, status: "active" | "busy" | "offline") => void;
}

export function AgentList({ agents, threads, onStatusChange }: AgentListProps) {
  // Helper to find threads assigned to an agent
  const getAssignedThreads = (agentId: string) => {
    return threads.filter((t) => t.assignedAgentIds.includes(agentId));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Team Collaborators ({agents.length})
        </h3>
        <span className="text-[10px] text-zinc-500" aria-hidden="true">
          Click status to toggle availability
        </span>
      </div>

      {agents.length === 0 ? (
        <div
          className="text-center py-8 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/5"
          role="status"
          aria-live="polite"
        >
          <p className="text-xs text-zinc-400 font-medium">No agents found in the roster.</p>
          <p className="text-[10px] text-zinc-500 mt-1">Check team assignments or refresh data.</p>
        </div>
      ) : (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"
          role="list"
          aria-label="Team Agents"
        >
          {agents.map((agent) => {
            const assigned = getAssignedThreads(agent.id);

            return (
              <div
                key={agent.id}
                role="listitem"
                className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 hover:bg-zinc-900/50 hover:border-zinc-700/80 transition-all duration-200 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-xl shadow-inner group-hover:scale-105 transition-transform duration-200">
                        {agent.avatar}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-sky-400 transition-colors duration-200">
                          {agent.name}
                        </h4>
                        <p className="text-xs text-zinc-400">{agent.role}</p>
                      </div>
                    </div>

                    {/* Interactive Status Selector */}
                    <select
                      aria-label={`Change status for ${agent.name}`}
                      value={agent.status}
                      onChange={(e) =>
                        onStatusChange(agent.id, e.target.value as "active" | "busy" | "offline")
                      }
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer bg-zinc-950 transition-all ${
                        agent.status === "active"
                          ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                          : agent.status === "busy"
                            ? "text-amber-400 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                            : "text-zinc-400 border-zinc-700 bg-zinc-800/20 hover:bg-zinc-800/40"
                      }`}
                    >
                      <option value="active" className="text-emerald-400 bg-zinc-950">
                        ● Active
                      </option>
                      <option value="busy" className="text-amber-400 bg-zinc-950">
                        ● Busy
                      </option>
                      <option value="offline" className="text-zinc-400 bg-zinc-950">
                        ○ Offline
                      </option>
                    </select>
                  </div>

                  {/* Specialties list */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {agent.specialties.map((spec) => (
                      <span
                        key={spec}
                        className="px-2 py-0.5 text-[9px] font-medium rounded-full bg-zinc-800/40 text-zinc-400 border border-zinc-800/80 uppercase tracking-wider"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Workload and assigned tasks */}
                <div className="mt-4 pt-3 border-t border-zinc-800/60 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Active Workload</span>
                    <span
                      className={`font-mono font-semibold px-1.5 py-0.5 rounded ${
                        agent.workload > 2
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : agent.workload > 0
                            ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                            : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {agent.workload} {agent.workload === 1 ? "thread" : "threads"}
                    </span>
                  </div>

                  {/* mini thread indicators */}
                  {assigned.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Assigned:</p>
                      <div className="max-h-20 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                        {assigned.map((t) => (
                          <div
                            key={t.id}
                            className="px-2 py-1 text-[10px] rounded bg-zinc-950/40 border border-zinc-800/50 flex justify-between items-center text-zinc-300 truncate"
                            title={t.subject}
                          >
                            <span className="truncate flex-1 font-medium">{t.subject}</span>
                            <span
                              className={`text-[8px] px-1 rounded ml-1 font-mono uppercase ${
                                t.priority === "high"
                                  ? "bg-rose-950 text-rose-400"
                                  : t.priority === "medium"
                                    ? "bg-amber-950 text-amber-400"
                                    : "bg-zinc-800 text-zinc-400"
                              }`}
                            >
                              {t.priority}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default AgentList;
