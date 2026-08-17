import { Clock, Gauge, Target, TrendingDown, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { FetchState, ResponseTimeMetrics as Metrics } from "../types";
import { StatsCard } from "./stats-card";

function formatDuration(ms: number): string {
  const hours = ms / 3600000;
  if (hours < 1) {
    const mins = Math.round(ms / 60000);
    return `${mins}m`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  const days = Math.round(hours / 24);
  return `${days}d`;
}

interface MetricsGridProps {
  children: ReactNode;
}

function MetricsGrid({ children }: MetricsGridProps) {
  return (
    <div
      className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="list"
      aria-label="Response time metrics"
    >
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <MetricsGrid>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border/40 bg-white/5 p-5 backdrop-blur-sm"
          aria-hidden="true"
        >
          <div className="mb-3 h-3 w-20 animate-pulse rounded bg-white/10" />
          <div className="h-8 w-24 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </MetricsGrid>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center backdrop-blur-sm"
      role="alert"
      aria-live="assertive"
    >
      <p className="text-sm font-medium text-red-400">{message}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mb-8 text-center" role="status">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-border/40 bg-white/5 text-muted-foreground">
        <Clock className="size-6" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted-foreground">No metrics available yet.</p>
    </div>
  );
}

interface ResponseTimeMetricsDisplayProps {
  metrics: Metrics;
}

function ResponseTimeMetricsDisplay({ metrics }: ResponseTimeMetricsDisplayProps) {
  return (
    <MetricsGrid>
      <StatsCard
        icon={<Clock className="size-4" />}
        label="Avg Response Time"
        value={formatDuration(metrics.averageResponseTimeMs)}
        trend="neutral"
        trendLabel="Overall average"
      />
      <StatsCard
        icon={<Gauge className="size-4" />}
        label="Median Response Time"
        value={formatDuration(metrics.medianResponseTimeMs)}
        trend="neutral"
        trendLabel="Middle value"
      />
      <StatsCard
        icon={<TrendingDown className="size-4" />}
        label="Fastest Response"
        value={formatDuration(metrics.fastestResponseTimeMs)}
        trend="up"
        trendLabel="Best time"
      />
      <StatsCard
        icon={<Target className="size-4" />}
        label="Within SLA"
        value={`${metrics.withinSLAPercentage}%`}
        trend={
          metrics.withinSLAPercentage >= 80
            ? "up"
            : metrics.withinSLAPercentage >= 50
              ? "neutral"
              : "down"
        }
        trendLabel={`${metrics.metCount} of ${metrics.totalResponses} responses`}
      />
      <StatsCard
        icon={<Users className="size-4" />}
        label="Total Responses"
        value={String(metrics.totalResponses)}
      />
      <StatsCard
        icon={<Clock className="size-4" />}
        label="Slowest Response"
        value={formatDuration(metrics.slowestResponseTimeMs)}
        trend="down"
        trendLabel="Needs improvement"
      />
    </MetricsGrid>
  );
}

interface ResponseTimeMetricsProps {
  state: FetchState<Metrics>;
}

export function ResponseTimeMetrics({ state }: ResponseTimeMetricsProps) {
  switch (state.status) {
    case "loading":
      return (
        <div aria-busy="true" aria-label="Loading metrics">
          <LoadingSkeleton />
        </div>
      );
    case "error":
      return <ErrorState message={state.message} />;
    case "empty":
      return <EmptyState />;
    case "success":
      return <ResponseTimeMetricsDisplay metrics={state.data} />;
  }
}
