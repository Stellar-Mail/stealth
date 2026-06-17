import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getIssueNavigation,
  groupBySeverity,
  SEVERITY_LABEL,
  summarizeValidation,
} from "./validation";
import type { ValidationIssue, ValidationNavigation, ValidationSeverity } from "./validation-types";

const SEVERITY_ICON: Record<ValidationSeverity, LucideIcon> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_STYLES: Record<ValidationSeverity, string> = {
  error: "border-red-500/30 bg-red-500/10 text-red-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-300",
};

export type ValidationResultsPanelProps = {
  issues: ValidationIssue[];
  onSelectIssue?: (navigation: ValidationNavigation, issue: ValidationIssue) => void;
  title?: string;
  className?: string;
};

export function ValidationResultsPanel({
  issues,
  onSelectIssue,
  title = "Validation results",
  className,
}: ValidationResultsPanelProps) {
  const summary = summarizeValidation(issues);
  const groups = groupBySeverity(issues);
  const interactive = Boolean(onSelectIssue);

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4",
        className,
      )}
      aria-label={title}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-300">
            {summary.error} errors
          </span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-300">
            {summary.warning} warnings
          </span>
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-300">
            {summary.info} info
          </span>
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-4 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>No validation issues found. This dataset looks good.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const Icon = SEVERITY_ICON[group.severity];
            return (
              <div key={group.severity} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span>
                    {SEVERITY_LABEL[group.severity]} ({group.issues.length})
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {group.issues.map((issue) => (
                    <li key={issue.id}>
                      <button
                        type="button"
                        disabled={!interactive}
                        onClick={
                          interactive
                            ? () => onSelectIssue?.(getIssueNavigation(issue), issue)
                            : undefined
                        }
                        className={cn(
                          "w-full rounded-md border px-3 py-2 text-left transition-colors",
                          SEVERITY_STYLES[issue.severity],
                          interactive ? "cursor-pointer hover:brightness-110" : "cursor-default",
                        )}
                      >
                        <span className="block text-[13px] font-medium text-foreground">
                          {issue.message}
                        </span>
                        <code className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {issue.fieldPath}
                        </code>
                        {issue.hint ? (
                          <p className="mt-1 text-[11px] text-muted-foreground/80">{issue.hint}</p>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
