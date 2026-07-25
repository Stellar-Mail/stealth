import React from "react";

export interface MemberCardProps {
  name: string;
  workload: number;
  capacity: number;
  selected?: boolean;
  onSelect?: () => void;
}

export function MemberCard({
  name,
  workload,
  capacity,
  selected = false,
  onSelect,
}: MemberCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="w-full rounded-lg border bg-card p-4 text-left transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <h3 className="text-sm font-semibold">{name}</h3>

      <p className="mt-2 text-xs text-muted-foreground">
        Workload: {workload} / {capacity}
      </p>

      <progress
        className="mt-3 w-full"
        max={capacity}
        value={workload}
        aria-label={`${name} workload`}
      />
    </button>
  );
}
