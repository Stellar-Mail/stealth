import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  FolderHeart,
  GitMerge,
  History,
  Plus,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Draft } from "../types/draft";
import type { CampaignSnapshot } from "../types/campaignSnapshot";
import { saveCampaignSnapshots, loadCampaignSnapshots } from "../persistence/localStorageAdapter";
import { deterministicSnapshotId, normalizeLabels } from "../utils/normalizeDemoData";
import {
  CAMPAIGN_STATUS_TOKENS,
  getTagToken,
  getAudienceToken,
  TAG_COLOR_TOKENS,
  AUDIENCE_BADGE_TOKENS,
} from "../constants/displayTokens";
import { ConflictResolver } from "./ConflictResolver";

interface CampaignSnapshotsProps {
  currentDataset: Draft[];
  onRestoreDataset: (dataset: Draft[]) => void;
  className?: string;
}

export function CampaignSnapshots({
  currentDataset,
  onRestoreDataset,
  className,
}: CampaignSnapshotsProps) {
  const [snapshots, setSnapshots] = useState<CampaignSnapshot[]>(() => loadCampaignSnapshots());

  // Form state for creating a new snapshot
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [status, setStatus] = useState<"active" | "draft" | "needs-review" | "archived">("draft");
  const [formError, setFormError] = useState("");

  // State for reference section visibility
  const [showRef, setShowRef] = useState(false);

  // State for restore confirmation dialog
  const [confirmRestoreTarget, setConfirmRestoreTarget] = useState<CampaignSnapshot | null>(null);

  // State for merge-with-conflict-resolution workflow
  const [mergeTarget, setMergeTarget] = useState<CampaignSnapshot | null>(null);

  // Helper to commit snapshots list and save to localStorage
  const commitSnapshots = (nextSnapshots: CampaignSnapshot[]) => {
    setSnapshots(nextSnapshots);
    saveCampaignSnapshots(nextSnapshots);
  };

  const handleSaveSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !targetAudience.trim()) {
      setFormError("Please fill out all required fields.");
      return;
    }

    if (currentDataset.length === 0) {
      setFormError("Cannot create a snapshot of an empty draft dataset.");
      return;
    }

    const newTags = normalizeLabels(tagsInput.split(","));
    const existingIds = new Set(snapshots.map((s) => s.id));

    const newSnapshot: CampaignSnapshot = {
      id: deterministicSnapshotId("snap", name.trim(), existingIds),
      name: name.trim(),
      description: description.trim(),
      targetAudience: targetAudience.trim(),
      tags: newTags,
      timestamp: new Date().toISOString(),
      status: status,
      drafts: [...currentDataset],
    };

    commitSnapshots([newSnapshot, ...snapshots]);

    // Reset form
    setName("");
    setDescription("");
    setTargetAudience("");
    setTagsInput("");
    setStatus("draft");
    setFormError("");
    setIsCreating(false);
  };

  const handleDeleteSnapshot = (id: string) => {
    const next = snapshots.filter((s) => s.id !== id);
    commitSnapshots(next);
  };

  const triggerRestore = (snapshot: CampaignSnapshot) => {
    setConfirmRestoreTarget(snapshot);
  };

  const handleConfirmRestore = () => {
    if (!confirmRestoreTarget) return;
    onRestoreDataset(confirmRestoreTarget.drafts);
    setConfirmRestoreTarget(null);
  };

  const handleMergeResolved = (resolvedDrafts: Draft[]) => {
    onRestoreDataset(resolvedDrafts);
    setMergeTarget(null);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <p className="text-sm text-muted-foreground">
        Save snapshots of your current draft dataset or restore previous campaign configurations.
        Preloaded scenario snapshots are available by default.
      </p>

      {/* ── Merge Conflict Resolver Modal ── */}
      {mergeTarget && (
        <ConflictResolver
          incomingDrafts={mergeTarget.drafts}
          existingDrafts={currentDataset}
          onResolve={handleMergeResolved}
          onCancel={() => setMergeTarget(null)}
        />
      )}

      {/* ── Restore Confirmation Modal / Alert ── */}
      {confirmRestoreTarget && (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5 backdrop-blur-md"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-4">
            <div className="mt-0.5 rounded-full bg-amber-500/10 p-2 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Confirm Campaign Restore</h4>
              <p className="text-xs text-muted-foreground">
                Are you sure you want to restore the campaign{" "}
                <strong className="text-foreground">“{confirmRestoreTarget.name}”</strong>? This
                will overwrite the current active draft dataset (
                <span className="font-semibold text-foreground">
                  {currentDataset.length} drafts
                </span>
                ) with this snapshot’s{" "}
                <span className="font-semibold text-foreground">
                  {confirmRestoreTarget.drafts.length} drafts
                </span>
                .
              </p>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-400"
                >
                  Confirm Restore
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRestoreTarget(null)}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-white/[0.06]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Top controls & creation trigger ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-2">
          <FolderHeart className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold text-foreground">
            Saved Campaigns{" "}
            <span className="text-muted-foreground tabular-nums">({snapshots.length})</span>
          </h4>
        </div>
        {!isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            disabled={currentDataset.length === 0}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              currentDataset.length === 0
                ? "cursor-not-allowed bg-white/[0.02] text-muted-foreground"
                : "bg-foreground text-background hover:opacity-90",
            )}
            title={
              currentDataset.length === 0
                ? "Add at least one draft template in the Templates section to save a snapshot"
                : undefined
            }
          >
            <Plus className="h-3.5 w-3.5" /> Save Current Drafts
          </button>
        )}
      </div>

      {/* ── Create Snapshot Form ── */}
      {isCreating && (
        <form
          onSubmit={handleSaveSnapshot}
          className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              New Campaign Snapshot
            </h5>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setFormError("");
              }}
              className="rounded-md p-1 text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {formError && <p className="text-xs font-medium text-rose-400">{formError}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="snap-name" className="text-xs font-medium text-muted-foreground">
                Campaign Name *
              </label>
              <input
                id="snap-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q3 Launch Announcement"
                className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-white/20 focus:outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="snap-audience" className="text-xs font-medium text-muted-foreground">
                Target Audience *
              </label>
              <input
                id="snap-audience"
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. New Signups"
                className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-white/20 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="snap-desc" className="text-xs font-medium text-muted-foreground">
                Description *
              </label>
              <input
                id="snap-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a detailed summary of what this campaign tests."
                className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-white/20 focus:outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="snap-status" className="text-xs font-medium text-muted-foreground">
                Campaign Status *
              </label>
              <select
                id="snap-status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "active" | "draft" | "needs-review" | "archived")
                }
                className="w-full rounded-lg border border-white/[0.08] bg-black-90 px-3 py-2 text-xs text-foreground focus:border-white/20 focus:outline-none"
                style={{ backgroundColor: "rgb(24 24 27)" }}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="needs-review">Needs Review</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="snap-tags" className="text-xs font-medium text-muted-foreground">
              Tags (comma-separated)
            </label>
            <input
              id="snap-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. stellar, onboarding, phase-1"
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-white/20 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setFormError("");
              }}
              className="rounded-lg border border-white/[0.08] bg-white/[0.01] px-4 py-2 text-xs font-medium text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90"
            >
              Save Snapshot
            </button>
          </div>
        </form>
      )}

      {/* ── Snapshots Grid List ── */}
      {snapshots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] py-12 text-center">
          <FolderHeart className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            No campaign snapshots found.
          </p>
          <p className="text-xs text-muted-foreground/60">
            Use the Template Picker to build a draft dataset first, then save it here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {snapshots.map((snap) => {
            const statusVal = snap.status || "draft";
            const statusToken = CAMPAIGN_STATUS_TOKENS[statusVal];
            const audToken = getAudienceToken(snap.targetAudience);

            return (
              <article
                key={snap.id}
                className="group flex flex-col justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition hover:border-white/[0.12] hover:bg-white/[0.03]"
              >
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h5 className="text-sm font-semibold text-foreground group-hover:text-sky-400 transition">
                        {snap.name}
                      </h5>
                      {/* Status Badge */}
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                          statusToken.bg,
                          statusToken.text,
                          statusToken.border,
                        )}
                      >
                        {statusToken.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSnapshot(snap.id)}
                      aria-label={`Delete campaign snapshot ${snap.name}`}
                      className="opacity-0 group-hover:opacity-100 rounded-md p-1 text-muted-foreground transition hover:bg-white/[0.06] hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {snap.description}
                  </p>

                  {/* Metadata details */}
                  <div className="space-y-2 pt-2 border-t border-white/[0.04] text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Target:{" "}
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ml-1",
                            audToken.bg,
                            audToken.text,
                            audToken.border,
                          )}
                        >
                          {audToken.label}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>Saved: {new Date(snap.timestamp).toLocaleString()}</span>
                    </div>
                    {snap.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center pt-1">
                        <Tag className="h-3 w-3 shrink-0" />
                        {snap.tags.map((tag) => {
                          const tagToken = getTagToken(tag);
                          return (
                            <span
                              key={tag}
                              className={cn(
                                "rounded-md border px-1.5 py-0.5 text-[9px] font-medium transition",
                                tagToken.bg,
                                tagToken.text,
                                tagToken.border,
                              )}
                            >
                              {tagToken.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Draft list preview */}
                  <div className="pt-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Drafts ({snap.drafts.length})
                    </span>
                    <ul className="space-y-1 rounded-lg border border-white/[0.04] bg-black/20 p-2 max-h-24 overflow-y-auto">
                      {snap.drafts.map((d) => (
                        <li
                          key={d.id}
                          className="truncate text-[11px] text-foreground/80 hover:text-foreground"
                        >
                          • {d.subject}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMergeTarget(snap)}
                    disabled={currentDataset.length === 0}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                      currentDataset.length === 0
                        ? "border-white/[0.04] bg-white/[0.01] text-muted-foreground/50 cursor-not-allowed"
                        : "border-indigo-500/20 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500/10",
                    )}
                    title="Merge this snapshot into the current active dataset with conflict resolution"
                  >
                    <GitMerge className="h-3.5 w-3.5" /> Merge Into Current
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerRestore(snap)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-white/[0.08]"
                  >
                    <History className="h-3.5 w-3.5" /> Restore Snapshot
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Display Tokens Reference & Badge Examples (Docs) ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <button
          type="button"
          onClick={() => setShowRef(!showRef)}
          className="flex w-full items-center justify-between text-left transition hover:text-foreground"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-sky-400" />
            <h5 className="text-sm font-semibold text-foreground">
              Campaign Display Tokens Reference & Badge Examples
            </h5>
          </div>
          <span className="text-xs text-muted-foreground hover:text-foreground">
            {showRef ? "Collapse" : "Expand"} Reference
          </span>
        </button>

        {showRef && (
          <div className="mt-4 space-y-6 border-t border-white/[0.06] pt-4 text-xs">
            <div>
              <h6 className="font-bold text-foreground mb-2">Campaign Status Badges</h6>
              <p className="text-muted-foreground mb-3 leading-relaxed">
                Determines the operational status of the campaign. Configured tokens map statuses to
                clear color codings:
              </p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(CAMPAIGN_STATUS_TOKENS).map(([key, token]) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.04] p-2 bg-black/20"
                  >
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                        token.bg,
                        token.text,
                        token.border,
                      )}
                    >
                      {token.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">{key}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h6 className="font-bold text-foreground mb-2">Campaign Tag Badges</h6>
              <p className="text-muted-foreground mb-3 leading-relaxed">
                Tags are mapped to semantic colors to distinguish categories (stellar updates,
                security notifications, newsletter editions, etc.) with slate defaults for custom
                tags:
              </p>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                {Object.entries(TAG_COLOR_TOKENS).map(([key, token]) => (
                  <div
                    key={key}
                    className="flex flex-col gap-1 rounded-lg border border-white/[0.04] p-2 bg-black/20"
                  >
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                      {key}
                    </span>
                    <span
                      className={cn(
                        "inline-flex self-start rounded-md border px-1.5 py-0.5 text-[9px] font-medium",
                        token.bg,
                        token.text,
                        token.border,
                      )}
                    >
                      {token.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h6 className="font-bold text-foreground mb-2">Audience Badges</h6>
              <p className="text-muted-foreground mb-3 leading-relaxed">
                Target audiences identify demo user segments. Standard segments are explicitly
                styled, and arbitrary entries fallback to purple templates:
              </p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(AUDIENCE_BADGE_TOKENS).map(([key, token]) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.04] p-2 bg-black/20"
                  >
                    <span
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[9px] font-semibold",
                        token.bg,
                        token.text,
                        token.border,
                      )}
                    >
                      {token.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">{key}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
