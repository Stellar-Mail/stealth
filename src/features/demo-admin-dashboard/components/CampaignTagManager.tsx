import { useState } from "react";
import { AlertTriangle, ArrowRightLeft, Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignTag, TagColorKey } from "../types/campaignTag";
import { getTagToken } from "../constants/displayTokens";
import { loadCampaignTags, saveCampaignTags } from "../persistence/localStorageAdapter";
import { loadCampaignSnapshots, saveCampaignSnapshots } from "../persistence/localStorageAdapter";
import type { CampaignSnapshot } from "../types/campaignSnapshot";
import {
  createTag,
  deleteTag,
  getTagUsageCount,
  mergeTag,
  renameTag,
  updateTagColor,
} from "../utils/tagOperations";
import { TagColorSelector } from "./TagColorSelector";

export function CampaignTagManager() {
  const [tags, setTags] = useState<CampaignTag[]>(() => loadCampaignTags());
  const [snapshots, setSnapshots] = useState<CampaignSnapshot[]>(() => loadCampaignSnapshots());

  // Mutually exclusive action state
  const [createMode, setCreateMode] = useState(false);
  const [editState, setEditState] = useState<{
    tagId: string;
    name: string;
    color: TagColorKey;
  } | null>(null);
  const [mergeState, setMergeState] = useState<{
    sourceId: string;
    targetId: string;
  } | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Create form state
  const [createName, setCreateName] = useState("");
  const [createColor, setCreateColor] = useState<TagColorKey>("onboarding");
  const [createError, setCreateError] = useState("");

  // Edit form error
  const [editError, setEditError] = useState("");

  const resetAllModes = () => {
    setCreateMode(false);
    setEditState(null);
    setMergeState(null);
    setDeleteTargetId(null);
    setCreateName("");
    setCreateColor("onboarding");
    setCreateError("");
    setEditError("");
  };

  const openCreate = () => {
    resetAllModes();
    setCreateMode(true);
  };

  const openEdit = (tag: CampaignTag) => {
    resetAllModes();
    setEditState({ tagId: tag.id, name: tag.name, color: tag.color });
  };

  const openMerge = (tag: CampaignTag) => {
    resetAllModes();
    const otherTags = tags.filter((t) => t.id !== tag.id);
    const defaultTarget = otherTags[0]?.id ?? "";
    setMergeState({ sourceId: tag.id, targetId: defaultTarget });
  };

  const openDelete = (tag: CampaignTag) => {
    resetAllModes();
    setDeleteTargetId(tag.id);
  };

  const commitTags = (nextTags: CampaignTag[]) => {
    setTags(nextTags);
    saveCampaignTags(nextTags);
  };

  const commitTagsAndSnapshots = (nextTags: CampaignTag[], nextSnapshots: CampaignSnapshot[]) => {
    setTags(nextTags);
    setSnapshots(nextSnapshots);
    saveCampaignTags(nextTags);
    saveCampaignSnapshots(nextSnapshots);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const result = createTag(tags, createName, createColor);
    if (!result.ok) {
      setCreateError(result.error);
      return;
    }
    commitTags(result.tags);
    resetAllModes();
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editState) return;
    const result = renameTag(tags, editState.tagId, editState.name);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    const withColor = updateTagColor(result.tags, editState.tagId, editState.color);
    commitTags(withColor);
    resetAllModes();
  };

  const handleMerge = () => {
    if (!mergeState || !mergeState.targetId) return;
    const { tags: nextTags, snapshots: nextSnapshots } = mergeTag(
      tags,
      snapshots,
      mergeState.sourceId,
      mergeState.targetId,
    );
    commitTagsAndSnapshots(nextTags, nextSnapshots);
    resetAllModes();
  };

  const handleDelete = () => {
    if (!deleteTargetId) return;
    const { tags: nextTags, snapshots: nextSnapshots } = deleteTag(tags, snapshots, deleteTargetId);
    commitTagsAndSnapshots(nextTags, nextSnapshots);
    resetAllModes();
  };

  const sortedTags = [...tags].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tags className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold text-foreground">Campaign Tags</h4>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {tags.length}
          </span>
        </div>
        {!createMode && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/[0.06]"
          >
            <Plus className="h-3.5 w-3.5" />
            New Tag
          </button>
        )}
      </div>

      {/* Create form */}
      {createMode && (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
        >
          <p className="text-xs font-semibold text-foreground">New Tag</p>
          <input
            autoFocus
            type="text"
            placeholder="Tag name"
            value={createName}
            onChange={(e) => {
              setCreateName(e.target.value);
              setCreateError("");
            }}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          {createError && <p className="text-[11px] text-rose-400">{createError}</p>}
          <TagColorSelector value={createColor} onChange={setCreateColor} />
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/[0.12]"
            >
              <Check className="h-3.5 w-3.5" />
              Create
            </button>
            <button
              type="button"
              onClick={resetAllModes}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tag list */}
      {sortedTags.length === 0 && !createMode ? (
        <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-white/[0.1] text-xs text-muted-foreground">
          No tags yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-1">
          {sortedTags.map((tag) => {
            const token = getTagToken(tag.name);
            const usageCount = getTagUsageCount(snapshots, tag.name);
            const isEditing = editState?.tagId === tag.id;
            const isMerging = mergeState?.sourceId === tag.id;
            const isDeleting = deleteTargetId === tag.id;
            const otherTags = tags.filter((t) => t.id !== tag.id);

            return (
              <div key={tag.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                {/* Default row */}
                {!isEditing && !isMerging && !isDeleting && (
                  <div className="group flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        token.bg,
                        token.text,
                        token.border,
                      )}
                    >
                      {tag.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {usageCount} {usageCount === 1 ? "campaign" : "campaigns"}
                    </span>
                    <div className="ml-auto flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => openEdit(tag)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      {otherTags.length > 0 && (
                        <button
                          type="button"
                          onClick={() => openMerge(tag)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                          Merge
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openDelete(tag)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-rose-400/70 hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                {/* Edit row */}
                {isEditing && editState && (
                  <form onSubmit={handleSaveEdit} className="space-y-3 p-4">
                    <p className="text-xs font-semibold text-foreground">Edit Tag</p>
                    <input
                      autoFocus
                      type="text"
                      value={editState.name}
                      onChange={(e) => {
                        setEditState({ ...editState, name: e.target.value });
                        setEditError("");
                      }}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                    {editError && <p className="text-[11px] text-rose-400">{editError}</p>}
                    <TagColorSelector
                      value={editState.color}
                      onChange={(color) => setEditState({ ...editState, color })}
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/[0.12]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={resetAllModes}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Merge row */}
                {isMerging && mergeState && (
                  <div className="space-y-3 p-4">
                    <p className="text-xs font-semibold text-foreground">
                      Merge{" "}
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px]",
                          token.bg,
                          token.text,
                          token.border,
                        )}
                      >
                        {tag.name}
                      </span>{" "}
                      into:
                    </p>
                    <select
                      value={mergeState.targetId}
                      onChange={(e) => setMergeState({ ...mergeState, targetId: e.target.value })}
                      className="w-full rounded-lg border border-white/[0.08] bg-black/60 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-white/20"
                    >
                      {otherTags.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      All campaigns using{" "}
                      <span className="font-medium text-foreground">"{tag.name}"</span> will be
                      updated to the target tag. The source tag will be removed.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleMerge}
                        className="flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/[0.12]"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Merge
                      </button>
                      <button
                        type="button"
                        onClick={resetAllModes}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete row */}
                {isDeleting && (
                  <div className="space-y-3 p-4">
                    <div className="flex items-center gap-2 text-rose-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <p className="text-xs font-semibold">Delete "{tag.name}"?</p>
                    </div>
                    {usageCount > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Used in{" "}
                        <span className="font-medium text-foreground">
                          {usageCount} {usageCount === 1 ? "campaign" : "campaigns"}
                        </span>{" "}
                        — will remove from all.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 transition hover:bg-rose-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={resetAllModes}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
