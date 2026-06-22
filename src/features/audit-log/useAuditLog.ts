import { useMemo, useState } from "react";
import { MOCK_AUDIT_EVENTS } from "./data";
import type { AuditEvent, AuditFilter } from "./types";

export function formatEventAsText(e: AuditEvent): string {
  const actor =
    e.actor.type === "user"
      ? (e.actor.displayName ?? e.actor.address)
      : e.actor.type === "relay"
        ? e.actor.relayId
        : "system";
  const ctx = e.context
    ? Object.entries(e.context)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")
    : "";
  return `[${e.ts}] ${e.kind} | ${actor} | ${e.summary}${ctx ? ` | ${ctx}` : ""}`;
}

export function filterAuditEvents(events: AuditEvent[], filter: AuditFilter): AuditEvent[] {
  return events.filter((event) => {
    if (filter.category !== "all" && event.category !== filter.category) return false;
    if (!filter.search) return true;

    const query = filter.search.toLowerCase();
    return (
      event.summary.toLowerCase().includes(query) ||
      event.kind.toLowerCase().includes(query) ||
      (event.context?.senderDisplayName?.toLowerCase().includes(query) ?? false) ||
      (event.context?.messageId?.toLowerCase().includes(query) ?? false)
    );
  });
}

export function hasActiveAuditFilter(filter: AuditFilter): boolean {
  return filter.category !== "all" || filter.search.trim().length > 0;
}

export function useAuditLog(initialEvents: AuditEvent[] = MOCK_AUDIT_EVENTS) {
  const [filter, setFilter] = useState<AuditFilter>({ category: "all", search: "" });

  const filtered = useMemo(() => filterAuditEvents(initialEvents, filter), [initialEvents, filter]);

  const copyDiagnostics = async (): Promise<boolean> => {
    if (filtered.length === 0) return false;

    try {
      const text = filtered.map(formatEventAsText).join("\n");
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const exportJson = (): boolean => {
    if (filtered.length === 0) return false;

    try {
      const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `stealth-audit-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  };

  const clearFilters = () => {
    setFilter({ category: "all", search: "" });
  };

  return {
    clearFilters,
    copyDiagnostics,
    events: filtered,
    exportJson,
    filter,
    hasActiveFilter: hasActiveAuditFilter(filter),
    setFilter,
    totalCount: initialEvents.length,
  };
}
