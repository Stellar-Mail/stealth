import { useState, useEffect, useRef } from "react";
import { Plus, X, Trash2, RotateCcw, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { defaultAudienceSegments } from "../fixtures/audienceSegmentFixtures";
import { defaultPersonas } from "../fixtures/personaFixtures";
import type { EditableSegment, SegmentEditorState } from "../types/segmentEditorState";
import {
  initEditorState,
  updateSegmentLabel,
  updateSegmentDescription,
  addCriteria,
  removeCriteria,
  validateSegment,
} from "../utils/segmentEditorHelpers";
import {
  assignPersonaToSegment,
  removePersonaFromSegment,
  getPersonasForSegment,
} from "../utils/personaHelpers";
import {
  saveSegmentEditorState,
  loadSegmentEditorState,
  clearSegmentEditorState,
} from "../persistence/localStorageAdapter";
import { AUDIENCE_SEGMENT_TOKENS } from "../constants/displayTokens";
import { AdminDataTable, type Column } from "./AdminDataTable";
import { PersonaPicker } from "./PersonaPicker";

const AVATAR_COLORS = [
  "bg-violet-500/20 text-violet-300",
  "bg-orange-500/20 text-orange-300",
  "bg-cyan-500/20 text-cyan-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-rose-500/20 text-rose-300",
  "bg-amber-500/20 text-amber-300",
  "bg-sky-500/20 text-sky-300",
  "bg-indigo-500/20 text-indigo-300",
];

function avatarColor(personaId: string): string {
  const n = parseInt(personaId.slice(-2), 10) || 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function ValidationDot({ segment }: { segment: EditableSegment }) {
  const result = validateSegment(segment);
  const hasError = result.errors.some((e) => e.severity === "error");
  const hasWarning = result.errors.some((e) => e.severity === "warning");
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full shrink-0",
        hasError ? "bg-rose-400" : hasWarning ? "bg-amber-400" : "bg-emerald-400",
      )}
      aria-hidden="true"
    />
  );
}

interface AudienceSegmentEditorProps {
  className?: string;
}

export function AudienceSegmentEditor({ className }: AudienceSegmentEditorProps) {
  const [state, setState] = useState<SegmentEditorState>(() => {
    const saved = loadSegmentEditorState();
    return saved ?? initEditorState(defaultAudienceSegments);
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [criterionInput, setCriterionInput] = useState("");
  const criterionRef = useRef<HTMLInputElement>(null);

  const selectedSegment = state.segments.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    saveSegmentEditorState(state);
  }, [state]);

  function updateSegment(updated: EditableSegment) {
    setState((prev) => ({
      segments: prev.segments.map((s) => (s.id === updated.id ? updated : s)),
    }));
  }

  function handleReset() {
    clearSegmentEditorState();
    const fresh = initEditorState(defaultAudienceSegments);
    setState(fresh);
    setSelectedId(null);
  }

  function handleAddCriterion() {
    if (!selectedSegment) return;
    const updated = addCriteria(selectedSegment, criterionInput);
    if (updated !== selectedSegment) {
      updateSegment(updated);
      setCriterionInput("");
    }
  }

  function handleCriterionKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCriterion();
    }
  }

  function handleTogglePersona(personaId: string) {
    if (!selectedSegment) return;
    const isAssigned = selectedSegment.personaIds.includes(personaId);
    const updated = isAssigned
      ? removePersonaFromSegment(selectedSegment, personaId)
      : assignPersonaToSegment(selectedSegment, personaId);
    updateSegment(updated);
  }

  // Segment list columns
  const segmentColumns: Column<EditableSegment>[] = [
    {
      key: "label",
      header: "Segment",
      sortable: true,
      render: (s) => {
        const tk = AUDIENCE_SEGMENT_TOKENS[s.id] ?? AUDIENCE_SEGMENT_TOKENS["unknown-senders"];
        return (
          <div className="flex items-center gap-2.5">
            <ValidationDot segment={s} />
            <span className="text-base leading-none">{s.icon}</span>
            <div>
              <p className="font-medium text-foreground">{s.label}</p>
              <span
                className={cn(
                  "mt-0.5 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium",
                  tk.bg,
                  tk.text,
                  tk.border,
                )}
              >
                {tk.label}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: "estimatedSize",
      header: "Est. Size",
      sortable: true,
      sortValue: (s) => s.estimatedSize,
      render: (s) => (
        <span className="tabular-nums text-muted-foreground">
          {s.estimatedSize.toLocaleString()}
        </span>
      ),
    },
    {
      key: "personas",
      header: "Personas",
      sortable: true,
      sortValue: (s) => s.personaIds.length,
      render: (s) => (
        <span className="tabular-nums text-muted-foreground">{s.personaIds.length}</span>
      ),
    },
  ];

  // Validation banners for right pane
  const validationResult = selectedSegment ? validateSegment(selectedSegment) : null;
  const assignedPersonas = selectedSegment
    ? getPersonasForSegment(selectedSegment, defaultPersonas)
    : [];

  return (
    <section aria-label="Audience segment editor" className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Audience Segment Editor</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Edit segment metadata and assign demo personas to each segment.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground"
          title="Reset all segments to fixture defaults"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        {/* Left: Segment list (~40%) */}
        <div className="md:w-[40%] space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-1">
            Segments
          </p>
          <AdminDataTable
            data={state.segments}
            columns={segmentColumns}
            onRowClick={(s) => setSelectedId(selectedId === s.id ? null : s.id)}
            selectedRowKey={(s) => s.id === selectedId}
            defaultSortKey="label"
            emptyMessage="No segments found."
          />
        </div>

        {/* Right: Segment editor (~60%) */}
        <div className="flex-1 space-y-4 min-w-0">
          {!selectedSegment ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.01] text-sm text-muted-foreground">
              Select a segment to view and edit its details.
            </div>
          ) : (
            <>
              {/* Segment header */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none">{selectedSegment.icon}</span>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Label
                    </label>
                    <input
                      type="text"
                      value={selectedSegment.label}
                      onChange={(e) =>
                        updateSegment(updateSegmentLabel(selectedSegment, e.target.value))
                      }
                      maxLength={60}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-foreground outline-none transition focus:border-white/20 placeholder:text-muted-foreground/50"
                      placeholder="Segment label…"
                    />
                    {validationResult?.errors
                      .filter((e) => e.field === "label")
                      .map((err, i) => (
                        <ValidationBanner key={i} error={err} />
                      ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Description
                  </label>
                  <textarea
                    value={selectedSegment.description}
                    onChange={(e) =>
                      updateSegment(updateSegmentDescription(selectedSegment, e.target.value))
                    }
                    rows={2}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none transition focus:border-white/20 resize-none placeholder:text-muted-foreground/50"
                    placeholder="Describe who this segment covers…"
                  />
                </div>
              </div>

              {/* Criteria */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Filter Criteria
                </p>
                {validationResult?.errors
                  .filter((e) => e.field === "criteria")
                  .map((err, i) => (
                    <ValidationBanner key={i} error={err} />
                  ))}
                <div className="flex flex-wrap gap-2">
                  {selectedSegment.criteria.map((criterion, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-foreground"
                    >
                      {criterion}
                      <button
                        type="button"
                        onClick={() => updateSegment(removeCriteria(selectedSegment, idx))}
                        aria-label={`Remove criterion: ${criterion}`}
                        className="rounded-full text-muted-foreground transition hover:text-rose-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {selectedSegment.criteria.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No criteria yet</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    ref={criterionRef}
                    type="text"
                    value={criterionInput}
                    onChange={(e) => setCriterionInput(e.target.value)}
                    onKeyDown={handleCriterionKeyDown}
                    placeholder="Add a criterion and press Enter…"
                    className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-foreground outline-none transition focus:border-white/20 placeholder:text-muted-foreground/50"
                  />
                  <button
                    type="button"
                    onClick={handleAddCriterion}
                    aria-label="Add criterion"
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/[0.07]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              </div>

              {/* Personas */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Personas ({selectedSegment.personaIds.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/[0.07]"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add personas
                  </button>
                </div>

                {validationResult?.errors
                  .filter((e) => e.field === "personas")
                  .map((err, i) => (
                    <ValidationBanner key={i} error={err} />
                  ))}

                {assignedPersonas.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No personas assigned yet — click Add personas.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {assignedPersonas.map((persona) => (
                      <div
                        key={persona.id}
                        className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                      >
                        <span
                          className={cn(
                            "shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold",
                            avatarColor(persona.id),
                          )}
                        >
                          {persona.avatar}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {persona.name}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {persona.email}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateSegment(removePersonaFromSegment(selectedSegment, persona.id))
                          }
                          aria-label={`Remove ${persona.name}`}
                          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {pickerOpen && selectedSegment && (
        <PersonaPicker
          pool={defaultPersonas}
          segment={selectedSegment}
          onToggle={handleTogglePersona}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </section>
  );
}

function ValidationBanner({
  error,
}: {
  error: { severity: "error" | "warning" | "info"; message: string };
}) {
  return (
    <p
      className={cn(
        "text-[11px] rounded-lg border px-3 py-1.5",
        error.severity === "error" && "bg-rose-500/10 border-rose-500/20 text-rose-400",
        error.severity === "warning" && "bg-amber-500/10 border-amber-500/20 text-amber-400",
        error.severity === "info" && "bg-slate-500/10 border-slate-500/20 text-slate-400",
      )}
    >
      {error.message}
    </p>
  );
}
