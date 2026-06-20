import { useState } from "react";
import {
  BadgeDollarSign,
  ClipboardCopy,
  ClipboardList,
  Download,
  Lock,
  Search,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionButton, EmptyState, Surface } from "@/features/design-system";
import { useAuditLog } from "./useAuditLog";
import type { AuditCategory, AuditEvent } from "./types";

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES: { value: AuditCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "policy", label: "Policy" },
  { value: "delivery", label: "Delivery" },
  { value: "security", label: "Security" },
  { value: "billing", label: "Billing" },
];

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  policy: "Policy",
  delivery: "Delivery",
  security: "Security",
  billing: "Billing",
};

const CATEGORY_DOT: Record<AuditCategory, string> = {
  policy: "bg-violet-400",
  delivery: "bg-sky-400",
  security: "bg-emerald-400",
  billing: "bg-amber-400",
};

const CATEGORY_ICON: Record<AuditCategory, React.ElementType> = {
  policy: ShieldCheck,
  delivery: Truck,
  security: Lock,
  billing: BadgeDollarSign,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTs(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatFullTs(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function formatActor(event: AuditEvent): string {
  const actor = event.actor;
  if (actor.type === "user") return actor.displayName ?? actor.address;
  if (actor.type === "relay") return actor.relayId;
  return "system";
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: AuditEvent }) {
  const Icon = CATEGORY_ICON[event.category];
  const context = event.context;

  return (
    <article
      aria-label={`${CATEGORY_LABEL[event.category]} event: ${event.summary}`}
      className="group flex gap-3 border-b border-white/[0.04] px-4 py-3 text-sm transition-colors hover:bg-white/[0.03] focus-within:bg-white/[0.03]"
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/[0.04] transition group-hover:bg-white/[0.06]">
        <Icon aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn("mt-px h-1.5 w-1.5 shrink-0 rounded-full", CATEGORY_DOT[event.category])}
          />
          <span className="sr-only">{CATEGORY_LABEL[event.category]}:</span>
          <span className="truncate text-foreground">{event.summary}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
          <span>{formatActor(event)}</span>
          {context?.senderDisplayName && <span>→ {context.senderDisplayName}</span>}
          {context?.messageId && (
            <span className="font-mono text-[10px] opacity-70">{context.messageId}</span>
          )}
          {context?.amount && (
            <span>
              {context.amount} {context.currency}
            </span>
          )}
        </div>
      </div>

      <time
        dateTime={event.ts}
        title={formatFullTs(event.ts)}
        className="shrink-0 self-start font-mono text-[10px] text-muted-foreground/70 tabular-nums"
      >
        {formatTs(event.ts)}
      </time>
    </article>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AuditLog() {
  const {
    clearFilters,
    copyDiagnostics,
    events,
    exportJson,
    filter,
    hasActiveFilter,
    setFilter,
    totalCount,
  } = useAuditLog();
  const [copyState, setCopyState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [exportState, setExportState] = useState<"idle" | "loading" | "error">("idle");

  const hasVisibleEvents = events.length > 0;
  const actionsDisabled = !hasVisibleEvents || copyState === "loading" || exportState === "loading";

  const handleCopy = async () => {
    if (actionsDisabled) return;

    setCopyState("loading");
    const ok = await copyDiagnostics();
    setCopyState(ok ? "success" : "error");
    window.setTimeout(() => setCopyState("idle"), ok ? 1800 : 2600);
  };

  const handleExport = () => {
    if (actionsDisabled) return;

    setExportState("loading");
    const ok = exportJson();
    setExportState(ok ? "idle" : "error");
    if (!ok) window.setTimeout(() => setExportState("idle"), 2600);
  };

  const copyLabel =
    copyState === "loading"
      ? "Copying…"
      : copyState === "success"
        ? "Copied"
        : copyState === "error"
          ? "Copy failed"
          : "Copy diagnostics";

  const exportLabel = exportState === "loading" ? "Exporting…" : "Export JSON";

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 transition focus-within:border-white/20 focus-within:bg-white/[0.05]">
          <Search aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={filter.search}
            onChange={(event) => setFilter({ ...filter, search: event.target.value })}
            placeholder="Search summaries, kinds, senders, or message IDs…"
            className="glow-ring w-full rounded-md bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            aria-label="Search audit events"
          />
          {filter.search ? (
            <button
              type="button"
              onClick={() => setFilter({ ...filter, search: "" })}
              className="glow-ring rounded-md p-1 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground active:scale-[0.98]"
              aria-label="Clear search"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="Filter audit events by category"
          >
            {CATEGORIES.map(({ value, label }) => {
              const isActive = filter.category === value;

              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setFilter({ ...filter, category: value })}
                  className={cn(
                    "glow-ring rounded-md px-2.5 py-1 text-xs font-medium transition active:scale-[0.98]",
                    isActive
                      ? "bg-white/[0.12] text-foreground ring-1 ring-white/10"
                      : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-1.5">
            <ActionButton
              type="button"
              intent="secondary"
              size="sm"
              onClick={handleCopy}
              disabled={actionsDisabled}
              aria-label={copyLabel}
              aria-busy={copyState === "loading"}
              className="min-w-[9.5rem]"
            >
              <ClipboardCopy aria-hidden className="h-3.5 w-3.5" />
              {copyLabel}
            </ActionButton>
            <ActionButton
              type="button"
              intent="secondary"
              size="sm"
              onClick={handleExport}
              disabled={actionsDisabled}
              aria-label={exportLabel}
              aria-busy={exportState === "loading"}
            >
              <Download aria-hidden className="h-3.5 w-3.5" />
              {exportLabel}
            </ActionButton>
          </div>
        </div>

        {(copyState === "error" || exportState === "error") && (
          <p className="rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            Could not complete that action. Try again, or export fewer events if your browser
            blocked clipboard or download access.
          </p>
        )}
      </div>

      <Surface
        padding="none"
        variant="tile"
        className="flex min-h-[16rem] flex-1 flex-col overflow-hidden"
      >
        {totalCount === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 py-10">
            <EmptyState
              icon={<ClipboardList aria-hidden className="h-6 w-6" />}
              eyebrow="Audit log"
              title="No protocol events yet"
              description="Policy changes, sender decisions, delivery proofs, and session activity will appear here once events are recorded. Message body content is never stored in the audit trail."
            />
          </div>
        ) : hasVisibleEvents ? (
          <div className="overflow-y-auto">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-4 py-10">
            <EmptyState
              icon={<Search aria-hidden className="h-6 w-6" />}
              eyebrow="No matches"
              title="No events match these filters"
              description="Try a broader search term or switch back to All categories. Only metadata such as event kind, sender label, and message ID is searchable."
              action={
                <ActionButton type="button" intent="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </ActionButton>
              }
            />
          </div>
        )}
      </Surface>

      {hasVisibleEvents ? (
        <p className="text-right text-[11px] text-muted-foreground/70">
          Showing {events.length} of {totalCount} event{totalCount !== 1 ? "s" : ""}
          {hasActiveFilter ? " for the current filters" : ""}
        </p>
      ) : null}
    </div>
  );
}
