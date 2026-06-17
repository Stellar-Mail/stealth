import { useMemo, useState } from "react";
import { Check, Plus, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignSnapshot } from "../types/campaignSnapshot";
import { getTagToken } from "../constants/displayTokens";
import {
  applyBulkTagEdit,
  parseTagInput,
  summarizeBulkTagEdit,
  type BulkTagEditResult,
  type BulkTagOperation,
} from "../bulkTagEditor";

export interface BulkTagEditorProps {
  campaigns: CampaignSnapshot[];
  onApply?: (result: BulkTagEditResult) => void;
  className?: string;
}

export function BulkTagEditor({ campaigns, onApply, className }: BulkTagEditorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState("");
  const [lastResult, setLastResult] = useState<BulkTagEditResult | null>(null);

  const parsedTags = useMemo(() => parseTagInput(tagsInput), [tagsInput]);
  const canApply = selectedIds.length > 0 && parsedTags.length > 0;

  const toggleCampaign = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const runEdit = (operation: BulkTagOperation) => {
    if (!canApply) {
      return;
    }
    const result = applyBulkTagEdit(campaigns, selectedIds, parsedTags, operation);
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
      <header className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Bulk tag editor</h3>
      </header>

      <ul className="flex flex-col gap-1">
        {campaigns.map((campaign) => {
          const checked = selectedIds.includes(campaign.id);
          return (
            <li key={campaign.id}>
              <button
                type="button"
                onClick={() => toggleCampaign(campaign.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  checked
                    ? "border-sky-500/40 bg-sky-500/10"
                    : "border-white/[0.06] hover:bg-white/[0.04]",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border",
                      checked ? "border-sky-400 bg-sky-500/20" : "border-white/20",
                    )}
                  >
                    {checked ? <Check className="h-3 w-3" /> : null}
                  </span>
                  {campaign.name}
                </span>
                <span className="flex flex-wrap gap-1">
                  {campaign.tags.map((tag) => {
                    const token = getTagToken(tag);
                    return (
                      <span
                        key={tag}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          token.bg,
                          token.text,
                          token.border,
                        )}
                      >
                        {token.label}
                      </span>
                    );
                  })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          aria-label="Tags to add or remove"
          placeholder="Tags (comma separated), e.g. promo, vip"
          className="rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-sky-500/40"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canApply}
            onClick={() => runEdit("add")}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition-colors",
              canApply
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                : "cursor-not-allowed border-white/[0.06] text-muted-foreground opacity-60",
            )}
          >
            <Plus className="h-4 w-4" />
            Add tags
          </button>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => runEdit("remove")}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition-colors",
              canApply
                ? "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                : "cursor-not-allowed border-white/[0.06] text-muted-foreground opacity-60",
            )}
          >
            <X className="h-4 w-4" />
            Remove tags
          </button>
        </div>
      </div>

      {lastResult ? (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-sm">
          <p className="font-medium">{summarizeBulkTagEdit(lastResult)}</p>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            {lastResult.changes
              .filter((change) => change.applied.length > 0)
              .map((change) => (
                <li key={change.id}>
                  {change.name}: {lastResult.operation === "add" ? "+" : "-"}
                  {change.applied.join(", ")}
                  {change.skipped.length > 0 ? ` (skipped ${change.skipped.join(", ")})` : ""}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
