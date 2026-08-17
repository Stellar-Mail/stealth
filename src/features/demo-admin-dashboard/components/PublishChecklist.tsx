import { AlertCircle, AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { summarizePublishChecklist } from "../publishChecklist";
import type {
  PublishChecklistItem,
  PublishChecklistResult,
  PublishChecklistStatus,
} from "../publishChecklist-types";

const STATUS_ICON: Record<PublishChecklistStatus, LucideIcon> = {
  pass: CheckCircle2,
  warning: AlertTriangle,
  blocked: AlertCircle,
};

const STATUS_LABEL: Record<PublishChecklistStatus, string> = {
  pass: "Passed",
  warning: "Warning",
  blocked: "Blocked",
};

const STATUS_STYLES: Record<PublishChecklistStatus, string> = {
  pass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  blocked: "border-red-500/30 bg-red-500/10 text-red-300",
};

const STATUS_ORDER: PublishChecklistStatus[] = ["blocked", "warning", "pass"];

export type PublishChecklistProps = {
  result: PublishChecklistResult;
  onPublish?: () => void;
  title?: string;
  className?: string;
};

function groupByStatus(items: PublishChecklistItem[]) {
  return STATUS_ORDER.map((status) => ({
    status,
    items: items.filter((entry) => entry.status === status),
  })).filter((group) => group.items.length > 0);
}

export function PublishChecklist({
  result,
  onPublish,
  title = "Publish checklist",
  className,
}: PublishChecklistProps) {
  const summary = summarizePublishChecklist(result.items);
  const groups = groupByStatus(result.items);
  const publishDisabled = !result.readyToPublish || !onPublish;

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4",
        className,
      )}
      aria-label={title}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {result.readyToPublish
              ? "This draft dataset is ready to populate the demo UI."
              : "Resolve blocked items before publishing."}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
            {summary.pass} passed
          </span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-300">
            {summary.warning} warnings
          </span>
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-300">
            {summary.blocked} blocked
          </span>
        </div>
      </header>

      {result.readyToPublish && summary.blocked === 0 && summary.warning === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-4 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>All checks passed. You can publish this dataset to the demo UI.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const Icon = STATUS_ICON[group.status];
            return (
              <div key={group.status} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span>
                    {STATUS_LABEL[group.status]} ({group.items.length})
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {group.items.map((entry) => (
                    <li
                      key={entry.id}
                      className={cn(
                        "rounded-md border px-3 py-2 text-left",
                        STATUS_STYLES[entry.status],
                      )}
                    >
                      <span className="block text-[13px] font-medium text-foreground">
                        {entry.label}
                      </span>
                      {entry.detail ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{entry.detail}</p>
                      ) : null}
                      {entry.hint ? (
                        <p className="mt-1 text-[11px] text-muted-foreground/80">{entry.hint}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {onPublish ? (
        <footer className="flex items-center justify-end border-t border-white/10 pt-3">
          <button
            type="button"
            disabled={publishDisabled}
            onClick={onPublish}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              publishDisabled
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            aria-disabled={publishDisabled}
          >
            {result.readyToPublish ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <CircleDashed className="h-4 w-4" />
            )}
            Publish to demo UI
          </button>
        </footer>
      ) : null}
    </section>
  );
}
