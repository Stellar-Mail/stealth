import { useMemo, useState } from "react";
import { MOCK_AUDIT_EVENTS } from "./data";
import type { AuditEvent, AuditFilter } from "./types";

function formatEventAsText(e: AuditEvent): string {
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

export function useAuditLog(initialEvents: AuditEvent[] = MOCK_AUDIT_EVENTS) {
  const [filter, setFilter] = useState<AuditFilter>({ category: "all", search: "" });

  const filtered = useMemo(() => {
    return initialEvents.filter((e) => {
      if (filter.category !== "all" && e.category !== filter.category) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        return (
          e.summary.toLowerCase().includes(q) ||
          e.kind.toLowerCase().includes(q) ||
          (e.context?.senderDisplayName?.toLowerCase().includes(q) ?? false) ||
          (e.context?.messageId?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [initialEvents, filter]);

  const copyDiagnostics = async () => {
    const text = filtered.map(formatEventAsText).join("\n");
    await navigator.clipboard.writeText(text);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stealth-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { events: filtered, filter, setFilter, copyDiagnostics, exportJson };
}
