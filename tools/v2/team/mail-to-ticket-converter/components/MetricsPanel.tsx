import type { TicketMetrics, FetchState } from "../types";
import { FetchStateHandler } from "./FetchStateHandler";

interface MetricsPanelProps {
  metrics: FetchState<TicketMetrics>;
  onRetry: () => void;
}

export function MetricsPanel({ metrics, onRetry }: MetricsPanelProps) {
  return (
    <FetchStateHandler
      state={metrics}
      onRetry={onRetry}
      loadingMessage="Loading metrics..."
      emptyMessage="No metrics available."
      errorMessage="Failed to load metrics."
    >
      {(data) => <MetricsDisplay metrics={data} />}
    </FetchStateHandler>
  );
}

function MetricsDisplay({ metrics }: { metrics: TicketMetrics }) {
  const statCards = [
    { label: "Total", value: metrics.totalTickets, color: "text-[--text-primary]" },
    { label: "Open", value: metrics.openTickets, color: "text-yellow-400" },
    { label: "In Progress", value: metrics.inProgressTickets, color: "text-blue-400" },
    { label: "Resolved", value: metrics.resolvedTickets, color: "text-green-400" },
    { label: "Closed", value: metrics.closedTickets, color: "text-gray-400" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex flex-col items-center gap-1 rounded-lg border border-[--border-subtle] bg-[--surface-primary] p-3"
          >
            <span className="text-2xl font-bold text-[--text-primary]">{card.value}</span>
            <span className="text-[10px] font-medium text-[--text-secondary]">{card.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[--border-subtle] bg-[--surface-primary] p-3">
          <h3 className="mb-2 text-xs font-semibold text-[--text-primary]">By Priority</h3>
          <div className="flex flex-col gap-1.5">
            {Object.entries(metrics.byPriority).map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between text-xs">
                <span className="text-[--text-secondary]">
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </span>
                <span className="font-medium text-[--text-primary]">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[--border-subtle] bg-[--surface-primary] p-3">
          <h3 className="mb-2 text-xs font-semibold text-[--text-primary]">By Category</h3>
          <div className="flex flex-col gap-1.5">
            {Object.entries(metrics.byCategory).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between text-xs">
                <span className="text-[--text-secondary]">
                  {category.charAt(0).toUpperCase() + category.slice(1).replace("-", " ")}
                </span>
                <span className="font-medium text-[--text-primary]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {metrics.averageResolutionTimeHours !== null && (
        <div className="rounded-lg border border-[--border-subtle] bg-[--surface-primary] p-3 text-center">
          <span className="text-xs text-[--text-secondary]">Average Resolution Time</span>
          <p className="text-lg font-semibold text-[--text-primary]">
            {metrics.averageResolutionTimeHours.toFixed(1)} hours
          </p>
        </div>
      )}
    </div>
  );
}
