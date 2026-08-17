import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Persona } from "../types/persona";
import type { EditableSegment } from "../types/segmentEditorState";
import { filterPersonas, isPersonaAssigned } from "../utils/personaHelpers";
import { AdminSearchBar } from "../AdminSearchBar";

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

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 8)}…`;
}

interface PersonaPickerProps {
  pool: Persona[];
  segment: EditableSegment;
  onToggle: (personaId: string) => void;
  onClose: () => void;
}

export function PersonaPicker({ pool, segment, onToggle, onClose }: PersonaPickerProps) {
  const [query, setQuery] = useState("");
  const filtered = filterPersonas(pool, query);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick personas to assign"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl border border-white/[0.10] bg-black/90 shadow-2xl backdrop-blur-xl overflow-hidden max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Add personas</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Assigning to{" "}
              <span className="text-foreground">
                {segment.icon} {segment.label}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close persona picker"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-white/[0.06] px-5 py-3">
          <AdminSearchBar
            value={query}
            onChange={setQuery}
            resultCount={filtered.length}
            totalCount={pool.length}
            placeholder="Search by name or email…"
          />
        </div>

        {/* Persona list */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
          {filtered.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No personas found.
            </p>
          ) : (
            filtered.map((persona) => {
              const assigned = isPersonaAssigned(segment, persona.id);
              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => onToggle(persona.id)}
                  className={cn(
                    "w-full px-5 py-3 text-left transition flex items-center gap-3",
                    "hover:bg-white/[0.03] cursor-pointer",
                  )}
                  aria-pressed={assigned}
                >
                  {/* Avatar */}
                  <span
                    className={cn(
                      "shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                      avatarColor(persona.id),
                    )}
                  >
                    {persona.avatar}
                  </span>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{persona.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {persona.email}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
                      {truncateAddress(persona.stellarAddress)}
                    </p>
                  </div>

                  {/* Assignment badge */}
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      assigned
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-white/[0.04] border-white/[0.08] text-muted-foreground",
                    )}
                  >
                    {assigned ? "Assigned" : "Add"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
