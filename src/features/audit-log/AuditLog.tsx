import { useState } from "react";
import {
  ClipboardCopy,
  Download,
  Search,
  ShieldCheck,
  Truck,
  BadgeDollarSign,
  Lock,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/features/design-system";
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
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatActor(event: AuditEvent): string {
  const a = event.actor;
  if (a.type === "user") return a.displayName ?? a.address;
  if (a.type === "relay") return a.relayId;
  return "system";
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: AuditEvent }) {
  const Icon = CATEGORY_ICON[event.category];
  const ctx = event.context;

  return (
    <div className="group flex gap-3 border-b border-white/[0.04] px-4 py-3 text-sm hover:bg-white/[0.02]">
      {/* Icon */}
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn("mt-px h-1.5 w-1.5 shrink-0 rounded-full", CATEGORY_DOT[event.category])}
          />
          <span className="truncate text-foreground">{event.summary}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
          <span>{formatActor(event)}</span>
          {ctx?.senderDisplayName && <span>→ {ctx.senderDisplayName}</span>}
          {ctx?.messageId && (
            <span className="font-mono text-[10px] opacity-60">{ctx.messageId}</span>
          )}
          {ctx?.amount && (
            <span>
              {ctx.amount} {ctx.currency}
            </span>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <time
        dateTime={event.ts}
        className="shrink-0 font-mono text-[10px] text-muted-foreground/60 tabular-nums"
      >
        {formatTs(event.ts)}
      </time>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AuditLog() {
  const { events, filter, setFilter, copyDiagnostics, exportJson } = useAuditLog();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyDiagnostics();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            placeholder="Search events…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            aria-label="Search audit events"
          />
        </div>

        {/* Category filter + CTAs */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter({ ...filter, category: value })}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition",
                  filter.category === value
                    ? "bg-white/[0.1] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-white/20 hover:text-foreground"
              aria-label="Copy diagnostics"
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={exportJson}
              className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-white/20 hover:text-foreground"
              aria-label="Export JSON"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02]">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center py-12">
            <EmptyState
              icon={<ClipboardList className="h-6 w-6" />}
              eyebrow="Audit log"
              title="No events yet"
              description="Policy changes, sender decisions, delivery proofs, and session events will appear here once activity starts. Message body content is never recorded."
            />
          </div>
        ) : (
          <div>
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* Footer count */}
      {events.length > 0 && (
        <p className="text-right text-[11px] text-muted-foreground/60">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
