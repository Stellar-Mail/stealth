import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Eye, RotateCcw, Save, Tags } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignSnapshot } from "../types/campaignSnapshot";
import {
  campaignEditorStateToSnapshot,
  campaignToEditorState,
  emptyCampaignEditorState,
  getCampaignEditorEmptyState,
  normalizeCampaignEditorTags,
  validateCampaignEditorState,
  type CampaignEditorState,
} from "../campaignEditor";
import { AdminEmptyState } from "./AdminEmptyState";

export interface CampaignEditorPanelProps {
  initialCampaign?: CampaignSnapshot;
  existingCampaignIds?: string[];
  now?: string;
  onSave?: (campaign: CampaignSnapshot) => void;
  className?: string;
}

export function CampaignEditorPanel({
  initialCampaign,
  existingCampaignIds = [],
  now = "2026-06-20T00:00:00Z",
  onSave,
  className,
}: CampaignEditorPanelProps) {
  const [state, setState] = useState<CampaignEditorState>(() =>
    initialCampaign ? campaignToEditorState(initialCampaign) : emptyCampaignEditorState,
  );
  const [showPreview, setShowPreview] = useState(false);
  const validation = useMemo(() => validateCampaignEditorState(state), [state]);
  const tags = normalizeCampaignEditorTags(state.tagsInput);
  const emptyState = getCampaignEditorEmptyState(state);

  const updateField = <Key extends keyof CampaignEditorState>(
    key: Key,
    value: CampaignEditorState[Key],
  ) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setState(initialCampaign ? campaignToEditorState(initialCampaign) : emptyCampaignEditorState);
    setShowPreview(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!validation.valid) {
      setShowPreview(true);
      return;
    }

    onSave?.(campaignEditorStateToSnapshot(state, new Set(existingCampaignIds), now));
    setShowPreview(true);
  };

  return (
    <section
      className={cn(
        "space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Tags className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Campaign editor</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Create or update deterministic demo campaign records for dashboard review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowPreview(true)} className={actionClass(true)}>
            <Eye className="h-4 w-4" />
            Preview
          </button>
          <button type="button" onClick={reset} className={actionClass(true)}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Campaign name" htmlFor="campaign-editor-name" required>
            <input
              id="campaign-editor-name"
              value={state.name}
              onChange={(event) => updateField("name", event.target.value)}
              className={inputClass}
              placeholder="Sender recovery education"
            />
          </Field>
          <Field label="Target audience" htmlFor="campaign-editor-audience" required>
            <input
              id="campaign-editor-audience"
              value={state.targetAudience}
              onChange={(event) => updateField("targetAudience", event.target.value)}
              className={inputClass}
              placeholder="Mailbox admins"
            />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <Field label="Tags" htmlFor="campaign-editor-tags">
            <input
              id="campaign-editor-tags"
              value={state.tagsInput}
              onChange={(event) => updateField("tagsInput", event.target.value)}
              className={inputClass}
              placeholder="recovery, requests, onboarding"
            />
          </Field>
          <Field label="Status" htmlFor="campaign-editor-status">
            <select
              id="campaign-editor-status"
              value={state.status}
              onChange={(event) =>
                updateField("status", event.target.value as CampaignEditorState["status"])
              }
              className={inputClass}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="needs-review">Needs review</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
        </div>

        <Field label="Description" htmlFor="campaign-editor-description" required>
          <textarea
            id="campaign-editor-description"
            value={state.description}
            onChange={(event) => updateField("description", event.target.value)}
            className={cn(inputClass, "min-h-24 resize-y")}
            placeholder="Describe what this fake campaign demonstrates for reviewers."
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{state.drafts.length}</span> demo drafts
            attached
            {tags.length > 0 ? (
              <span>
                {" "}
                across <span className="font-medium text-foreground">{tags.length}</span> tags
              </span>
            ) : null}
          </div>
          <button type="submit" className={actionClass(validation.valid)}>
            <Save className="h-4 w-4" />
            Save shell
          </button>
        </div>
      </form>

      {emptyState ? (
        <AdminEmptyState
          title={emptyState.title}
          description={emptyState.description}
          action={
            <span className="mt-3 text-xs text-muted-foreground">{emptyState.actionLabel}</span>
          }
        />
      ) : null}

      {(showPreview || !validation.valid || validation.warnings.length > 0) && (
        <div className="space-y-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Review preview</p>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs",
                validation.valid
                  ? "border-emerald-500/30 text-emerald-300"
                  : "border-rose-500/30 text-rose-300",
              )}
            >
              {validation.valid ? "valid" : "needs metadata"}
            </span>
          </div>
          <div className="grid gap-2 text-xs md:grid-cols-3">
            <PreviewMetric label="Name" value={state.name || "Not set"} />
            <PreviewMetric label="Audience" value={state.targetAudience || "Not set"} />
            <PreviewMetric label="Status" value={state.status} />
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <ValidationList tone="error" items={validation.errors} />
          <ValidationList tone="warning" items={validation.warnings} />
        </div>
      )}
    </section>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-white/20 focus:outline-none";

function Field({
  label,
  htmlFor,
  required = false,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium text-foreground">{value}</p>
    </div>
  );
}

function ValidationList({ tone, items }: { tone: "error" | "warning"; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul
      className={cn(
        "space-y-1 rounded-md border px-3 py-2 text-xs",
        tone === "error"
          ? "border-rose-500/20 text-rose-200"
          : "border-amber-500/20 text-amber-200",
      )}
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function actionClass(enabled: boolean): string {
  return cn(
    "inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition-colors",
    enabled
      ? "border-white/[0.08] text-foreground hover:bg-white/[0.04]"
      : "cursor-not-allowed border-white/[0.06] text-muted-foreground opacity-60",
  );
}
