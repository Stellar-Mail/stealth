import { useState, useMemo, useCallback } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  GitMerge,
  Layers,
  RefreshCw,
  Shield,
  Tag,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Draft } from "../types/draft";

// ─── Conflict Types ───────────────────────────────────────────────────────────

export type ConflictType = "duplicate-id" | "sender-collision" | "label-conflict";

export type ResolutionAction = "overwrite" | "keep-existing" | "keep-both" | "merge-labels";

export interface Conflict {
  id: string;
  type: ConflictType;
  incoming: Draft;
  existing: Draft;
  resolution: ResolutionAction | null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConflictResolverProps {
  incomingDrafts: Draft[];
  existingDrafts: Draft[];
  onResolve: (resolvedDrafts: Draft[]) => void;
  onCancel: () => void;
}

// ─── Conflict Detection ───────────────────────────────────────────────────────

/**
 * Detects conflicts between incoming and existing drafts.
 *
 * Conflict types:
 * - duplicate-id: Same `id` but differing `subject` or `body`.
 * - sender-collision: Same first recipient domain but differing properties.
 * - label-conflict: Same `subject` but different `id` (possible duplicate content).
 */
export function detectConflicts(incomingDrafts: Draft[], existingDrafts: Draft[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();

  for (const incoming of incomingDrafts) {
    // 1. Duplicate ID
    const byId = existingDrafts.find((e) => e.id === incoming.id);
    if (byId && (byId.subject !== incoming.subject || byId.body !== incoming.body)) {
      const key = `dup-${incoming.id}`;
      if (!seen.has(key)) {
        conflicts.push({
          id: key,
          type: "duplicate-id",
          incoming,
          existing: byId,
          resolution: null,
        });
        seen.add(key);
      }
    }

    // 2. Sender Collision – same first recipient domain but different subject/body
    if (incoming.recipients.length > 0) {
      const incomingDomain = incoming.recipients[0]?.split("@")[1] ?? "";
      if (incomingDomain) {
        const bySender = existingDrafts.find((e) => {
          if (e.id === incoming.id) return false; // already covered by dup-id
          const existingDomain = e.recipients[0]?.split("@")[1] ?? "";
          return (
            existingDomain === incomingDomain &&
            (e.subject !== incoming.subject || e.body !== incoming.body)
          );
        });
        if (bySender) {
          const key = `sender-${incoming.id}-${bySender.id}`;
          if (!seen.has(key)) {
            conflicts.push({
              id: key,
              type: "sender-collision",
              incoming,
              existing: bySender,
              resolution: null,
            });
            seen.add(key);
          }
        }
      }
    }

    // 3. Label Conflict – same subject but different ID (possible content fork)
    const bySubject = existingDrafts.find(
      (e) => e.subject === incoming.subject && e.id !== incoming.id,
    );
    if (bySubject) {
      const key = `label-${incoming.id}-${bySubject.id}`;
      if (!seen.has(key)) {
        conflicts.push({
          id: key,
          type: "label-conflict",
          incoming,
          existing: bySubject,
          resolution: null,
        });
        seen.add(key);
      }
    }
  }

  return conflicts;
}

// ─── Resolution Logic ─────────────────────────────────────────────────────────

/**
 * Applies resolved conflicts to produce a final merged draft list.
 *
 * Non-conflicting incoming drafts are appended automatically.
 * For conflicting drafts, the chosen resolution action determines outcome.
 */
export function applyResolutions(
  incomingDrafts: Draft[],
  existingDrafts: Draft[],
  conflicts: Conflict[],
): Draft[] {
  const result = [...existingDrafts];

  // Track which incoming drafts are covered by conflicts
  const conflictIncomingIds = new Set(conflicts.map((c) => c.incoming.id));

  // Apply conflict resolutions
  for (const conflict of conflicts) {
    const resolution = conflict.resolution ?? "keep-existing";
    const existingIdx = result.findIndex((d) => d.id === conflict.existing.id);

    switch (resolution) {
      case "overwrite":
        if (existingIdx !== -1) {
          result[existingIdx] = { ...conflict.incoming };
        }
        break;

      case "keep-existing":
        // No change needed
        break;

      case "keep-both": {
        const newDraft: Draft = {
          ...conflict.incoming,
          id: `${conflict.incoming.id}-merged-${Date.now()}`,
        };
        result.push(newDraft);
        break;
      }

      case "merge-labels":
        // Since Draft doesn't have labels, we merge recipients instead
        if (existingIdx !== -1) {
          const mergedRecipients = Array.from(
            new Set([...result[existingIdx].recipients, ...conflict.incoming.recipients]),
          );
          result[existingIdx] = {
            ...result[existingIdx],
            recipients: mergedRecipients,
          };
        }
        break;
    }
  }

  // Append non-conflicting incoming drafts that don't already exist
  for (const incoming of incomingDrafts) {
    if (!conflictIncomingIds.has(incoming.id)) {
      const alreadyExists = result.some((d) => d.id === incoming.id);
      if (!alreadyExists) {
        result.push({ ...incoming });
      }
    }
  }

  return result;
}

// ─── UI Constants ─────────────────────────────────────────────────────────────

const CONFLICT_TYPE_META: Record<
  ConflictType,
  { label: string; icon: React.ElementType; color: string; borderColor: string; bgColor: string }
> = {
  "duplicate-id": {
    label: "Duplicate ID",
    icon: Copy,
    color: "text-rose-400",
    borderColor: "border-rose-500/20",
    bgColor: "bg-rose-500/10",
  },
  "sender-collision": {
    label: "Sender Collision",
    icon: RefreshCw,
    color: "text-amber-400",
    borderColor: "border-amber-500/20",
    bgColor: "bg-amber-500/10",
  },
  "label-conflict": {
    label: "Label Conflict",
    icon: Tag,
    color: "text-sky-400",
    borderColor: "border-sky-500/20",
    bgColor: "bg-sky-500/10",
  },
};

const RESOLUTION_LABELS: Record<ResolutionAction, { label: string; description: string }> = {
  overwrite: { label: "Overwrite", description: "Replace existing with incoming" },
  "keep-existing": { label: "Keep Existing", description: "Ignore the incoming draft" },
  "keep-both": { label: "Keep Both", description: "Auto-rename incoming and keep both" },
  "merge-labels": { label: "Merge", description: "Combine recipients from both" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ConflictResolver({
  incomingDrafts,
  existingDrafts,
  onResolve,
  onCancel,
}: ConflictResolverProps) {
  const detectedConflicts = useMemo(
    () => detectConflicts(incomingDrafts, existingDrafts),
    [incomingDrafts, existingDrafts],
  );

  const [conflicts, setConflicts] = useState<Conflict[]>(detectedConflicts);

  const allResolved = conflicts.every((c) => c.resolution !== null);
  const resolvedCount = conflicts.filter((c) => c.resolution !== null).length;

  const setResolution = useCallback((conflictId: string, action: ResolutionAction) => {
    setConflicts((prev) =>
      prev.map((c) => (c.id === conflictId ? { ...c, resolution: action } : c)),
    );
  }, []);

  const applyBulkResolution = useCallback((action: ResolutionAction) => {
    setConflicts((prev) => prev.map((c) => ({ ...c, resolution: action })));
  }, []);

  const handleApply = () => {
    const resolved = applyResolutions(incomingDrafts, existingDrafts, conflicts);
    onResolve(resolved);
  };

  // No conflicts – auto-merge
  if (detectedConflicts.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-6 space-y-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-400">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">No Conflicts Detected</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              All {incomingDrafts.length} incoming drafts can be safely merged without conflicts.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              const merged = [...existingDrafts];
              for (const inc of incomingDrafts) {
                if (!merged.some((d) => d.id === inc.id)) {
                  merged.push({ ...inc });
                }
              }
              onResolve(merged);
            }}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-black transition hover:bg-emerald-400"
          >
            Merge All
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white/[0.06]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-amber-500/10 p-2 text-amber-400">
            <GitMerge className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Resolve Merge Conflicts</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""} detected ·{" "}
              <span className={allResolved ? "text-emerald-400" : "text-amber-400"}>
                {resolvedCount}/{conflicts.length} resolved
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition"
          aria-label="Close conflict resolver"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Bulk Actions ── */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3 bg-white/[0.01]">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-2">
          Resolve All:
        </span>
        {(Object.keys(RESOLUTION_LABELS) as ResolutionAction[]).map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => applyBulkResolution(action)}
            className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
            title={RESOLUTION_LABELS[action].description}
          >
            {RESOLUTION_LABELS[action].label}
          </button>
        ))}
      </div>

      {/* ── Conflict List ── */}
      <div className="max-h-96 overflow-y-auto divide-y divide-white/[0.04]">
        {conflicts.map((conflict) => {
          const meta = CONFLICT_TYPE_META[conflict.type];
          const IconComp = meta.icon;

          return (
            <div key={conflict.id} className="px-5 py-4 space-y-3 hover:bg-white/[0.01] transition">
              {/* Conflict header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                      meta.bgColor,
                      meta.color,
                      meta.borderColor,
                    )}
                  >
                    <IconComp className="h-3 w-3" />
                    {meta.label}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate max-w-52">
                    {conflict.incoming.subject}
                  </span>
                </div>
                {conflict.resolution && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400 border border-emerald-500/20">
                    <Check className="h-2.5 w-2.5" />
                    {RESOLUTION_LABELS[conflict.resolution].label}
                  </span>
                )}
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/[0.04] bg-black/20 p-3 space-y-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Existing
                  </span>
                  <p className="text-[11px] font-medium text-foreground truncate">
                    {conflict.existing.subject}
                  </p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">
                    {conflict.existing.body}
                  </p>
                  <p className="text-[9px] font-mono text-muted-foreground/60">
                    ID: {conflict.existing.id}
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.04] bg-black/20 p-3 space-y-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
                    Incoming
                  </span>
                  <p className="text-[11px] font-medium text-foreground truncate">
                    {conflict.incoming.subject}
                  </p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">
                    {conflict.incoming.body}
                  </p>
                  <p className="text-[9px] font-mono text-muted-foreground/60">
                    ID: {conflict.incoming.id}
                  </p>
                </div>
              </div>

              {/* Resolution buttons */}
              <div className="flex items-center gap-2">
                {(Object.keys(RESOLUTION_LABELS) as ResolutionAction[]).map((action) => {
                  const isSelected = conflict.resolution === action;
                  return (
                    <button
                      key={action}
                      type="button"
                      onClick={() => setResolution(conflict.id, action)}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition",
                        isSelected
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                      )}
                      title={RESOLUTION_LABELS[action].description}
                    >
                      {RESOLUTION_LABELS[action].label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-4 bg-white/[0.01]">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          <span>
            {incomingDrafts.length} incoming · {existingDrafts.length} existing
          </span>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!allResolved}
            className={cn(
              "rounded-lg px-4 py-2 text-xs font-semibold transition inline-flex items-center gap-1.5",
              allResolved
                ? "bg-emerald-500 text-black hover:bg-emerald-400"
                : "bg-white/[0.04] text-muted-foreground cursor-not-allowed",
            )}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Apply {resolvedCount} Resolution{resolvedCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
