import { useMemo, useState } from "react";
import { Plus, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyBulkLabelEdit,
  parseDraftLabelInput,
  summarizeBulkLabelEdit,
  type BulkLabelEditResult,
  type BulkLabelOperation,
  type DraftLabelMessage,
} from "../bulkLabelEditor";

export interface BulkLabelPanelProps {
  messages: DraftLabelMessage[];
  selectedIds: string[];
  onApply?: (result: BulkLabelEditResult) => void;
  className?: string;
}

export function BulkLabelPanel({ messages, selectedIds, onApply, className }: BulkLabelPanelProps) {
  const [input, setInput] = useState("");
  const [lastResult, setLastResult] = useState<BulkLabelEditResult | null>(null);
  const parsedLabels = useMemo(() => parseDraftLabelInput(input), [input]);
  const selectedCount = selectedIds.filter((id) =>
    messages.some((message) => message.id === id),
  ).length;
  const canApply = selectedCount > 0 && parsedLabels.length > 0;

  const runEdit = (operation: BulkLabelOperation) => {
    if (!canApply) {
      return;
    }
    const result = applyBulkLabelEdit(messages, selectedIds, parsedLabels, operation);
    setLastResult(result);
    onApply?.(result);
  };

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Bulk label panel</h3>
        </div>
        <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-xs text-muted-foreground">
          {selectedCount} selected
        </span>
      </header>

      <input
        type="text"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        aria-label="Draft labels to add or remove"
        placeholder="Labels, e.g. review, investor"
        className="rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-sky-500/40"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canApply}
          onClick={() => runEdit("add")}
          className={actionButtonClass(canApply)}
        >
          <Plus className="h-4 w-4" />
          Add labels
        </button>
        <button
          type="button"
          disabled={!canApply}
          onClick={() => runEdit("remove")}
          className={actionButtonClass(canApply)}
        >
          <X className="h-4 w-4" />
          Remove labels
        </button>
      </div>

      {lastResult ? (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-sm">
          <p className="font-medium">{summarizeBulkLabelEdit(lastResult)}</p>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            {lastResult.changes.map((change) => (
              <li key={change.id}>
                {change.subject}: {change.applied.join(", ") || "no changes"}
                {change.skipped.length > 0 ? ` (${change.skipped.join(", ")} skipped)` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function actionButtonClass(enabled: boolean): string {
  return cn(
    "inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition-colors",
    enabled
      ? "border-white/[0.08] text-foreground hover:bg-white/[0.04]"
      : "cursor-not-allowed border-white/[0.06] text-muted-foreground opacity-60",
  );
}
