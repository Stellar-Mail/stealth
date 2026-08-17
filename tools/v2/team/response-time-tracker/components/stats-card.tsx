import type { ReactNode } from "react";

interface StatsCardProps {
  icon?: ReactNode;
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
}

export function StatsCard({ icon, label, value, trend, trendLabel }: StatsCardProps) {
  const trendColors: Record<string, string> = {
    up: "text-green-500",
    down: "text-red-500",
    neutral: "text-muted-foreground",
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border/40 bg-white/5 p-5 backdrop-blur-sm"
      role="region"
      aria-label={label}
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        {icon ? (
          <div
            className="flex size-8 items-center justify-center rounded-lg bg-white/5 text-foreground"
            aria-hidden="true"
          >
            {icon}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-3xl font-semibold text-foreground" aria-live="polite">
        {value}
      </p>
      {trend && trendLabel ? (
        <p className={`mt-1 text-xs ${trendColors[trend] ?? trendColors.neutral}`}>
          <span aria-hidden="true">{trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}</span>{" "}
          <span>{trendLabel}</span>
        </p>
      ) : null}
    </div>
  );
}
