import React from "react";
import { ExtractionStats } from "../types";

interface StatusIndicatorsProps {
  stats: ExtractionStats | null;
  errors: string[];
  logs: string[];
}

export function StatusIndicators({ stats, errors, logs }: StatusIndicatorsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Performance Stats */}
      <div className="border border-border/80 rounded-xl bg-card/30 p-5 flex flex-col justify-between">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span>⚡ Performance Telemetry</span>
        </h4>
        {stats ? (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-border/30 pb-1.5">
              <span className="text-muted-foreground">Bytes Processed</span>
              <span className="font-mono font-bold text-foreground">
                {(stats.bytesProcessed / 1024).toFixed(2)} KB
              </span>
            </div>
            <div className="flex justify-between border-b border-border/30 pb-1.5">
              <span className="text-muted-foreground">Execution Time</span>
              <span className="font-mono font-bold text-sky-400">{stats.timeElapsedMs} ms</span>
            </div>
            <div className="flex justify-between border-b border-border/30 pb-1.5">
              <span className="text-muted-foreground">Events Found</span>
              <span className="font-mono font-bold text-foreground">{stats.eventsFound}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Events Validated</span>
              <span className="font-mono font-bold text-emerald-400">{stats.eventsExtracted}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Run extraction to view stats.</p>
        )}
      </div>

      {/* Safety Logs */}
      <div className="border border-border/80 rounded-xl bg-card/30 p-5 flex flex-col justify-between md:col-span-2">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span>🛡️ Safety Scanner Output</span>
          {errors.length > 0 && (
            <span className="text-[10px] bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded-full">
              {errors.length} Warnings
            </span>
          )}
        </h4>

        <div className="flex-1 flex flex-col gap-3 min-h-[120px]">
          {/* Active Logs Console */}
          <div className="flex-1 bg-black/40 border border-border/50 rounded-lg p-3 font-mono text-[11px] text-zinc-300 max-h-[120px] overflow-y-auto space-y-1 scrollbar-thin">
            {logs.length === 0 ? (
              <span className="text-zinc-500 italic">&gt; Awaiting process activation...</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="leading-5">
                  <span className="text-zinc-500 mr-2">&gt;</span>
                  {log}
                </div>
              ))
            )}
          </div>

          {/* Validation & Parsing Errors */}
          {errors.length > 0 && (
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-3 text-xs text-rose-400 space-y-1">
              <span className="font-semibold block text-[11px] uppercase tracking-wider text-rose-500 mb-1">
                Rejected / Blocked Entries:
              </span>
              <ul className="list-disc list-inside space-y-1 max-h-[80px] overflow-y-auto">
                {errors.map((err, i) => (
                  <li key={i} className="truncate" title={err}>
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
