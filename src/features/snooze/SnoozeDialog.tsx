import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CalendarClock, Check, Clock, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getLocalTimeZone, getReferenceNow, type CalendarEvent } from "@/features/calendar";
import type { SnoozeState } from "@/components/mail/data";
import type { SnoozeTarget } from "./useSnooze";
import {
  SNOOZE_PRESETS,
  buildSnoozeState,
  findSnoozeConflicts,
  validateCustomSnooze,
  type SnoozeChoice,
} from "./types";

type Props = {
  /** Non-null while the dialog is open. */
  target: SnoozeTarget | null;
  /** Existing reminder when editing from the snoozed folder, else undefined. */
  initialState?: SnoozeState;
  /** Calendar events used to warn about conflicts near the chosen time. */
  events: CalendarEvent[];
  /** Apply the reminder. The route owns the mutation. */
  onConfirm: (target: SnoozeTarget, state: SnoozeState) => void;
  /** Close with no change. */
  onClose: () => void;
};

const inputClass =
  "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-white/25 [color-scheme:dark]";

/**
 * Smart snooze dialog: one-tap presets plus a custom date/time, with a live
 * reminder preview and calendar-conflict warnings. Fully keyboard operable —
 * presets are buttons, custom uses native date/time inputs, Enter confirms and
 * Esc cancels. Cancel/backdrop/Esc close with no policy change.
 */
export function SnoozeDialog({ target, initialState, events, onConfirm, onClose }: Props) {
  const now = getReferenceNow();
  const [choice, setChoice] = useState<SnoozeChoice | null>(null);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");

  // Seed from an existing reminder when editing; otherwise start blank so no
  // option is pre-applied.
  useEffect(() => {
    if (!target) return;
    if (initialState) {
      setChoice(initialState.choice);
      if (initialState.choice === "custom") {
        const d = new Date(initialState.remindAt);
        setCustomDate(format(d, "yyyy-MM-dd"));
        setCustomTime(format(d, "HH:mm"));
      }
    } else {
      setChoice(null);
      setCustomDate("");
      setCustomTime("");
    }
  }, [target?.emailId, initialState, target]);

  useEffect(() => {
    if (!target) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [target, onClose]);

  // Resolve the selected choice into a concrete reminder + validity. Memoized so
  // the preview and conflict list recompute only when inputs change.
  const resolved = useMemo(() => {
    if (choice === "custom") {
      const validation = validateCustomSnooze(customDate, customTime, now);
      return validation.ok
        ? { remindAt: validation.remindAt, error: null as string | null }
        : { remindAt: null, error: validation.error };
    }
    if (choice) {
      const preset = SNOOZE_PRESETS.find((item) => item.id === choice);
      if (preset) return { remindAt: preset.resolve(now), error: null as string | null };
    }
    return { remindAt: null as Date | null, error: null as string | null };
  }, [choice, customDate, customTime, now]);

  const conflicts = useMemo(
    () => (resolved.remindAt ? findSnoozeConflicts(resolved.remindAt, events) : []),
    [resolved.remindAt, events],
  );

  const canConfirm = resolved.remindAt !== null && resolved.error === null;

  const handleConfirm = () => {
    if (!target || !choice || !resolved.remindAt) return;
    onConfirm(target, buildSnoozeState(choice, resolved.remindAt, now));
  };

  return (
    <AnimatePresence>
      {target && (
        <>
          <motion.div
            key="snooze-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
          />
          <motion.div
            key="snooze-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Snooze message"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canConfirm) handleConfirm();
            }}
            className="glass-strong fixed left-1/2 top-1/2 z-50 w-[min(460px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 px-6 pt-5">
              <div className="min-w-0 space-y-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {initialState ? "Edit snooze" : "Snooze until"}
                </p>
                <h2 className="truncate text-base font-semibold text-foreground">
                  {target.subject}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Cancel"
                className="glow-ring shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-6 pt-4">
              <div className="grid grid-cols-3 gap-2">
                {SNOOZE_PRESETS.map((preset) => {
                  const selected = choice === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setChoice(preset.id)}
                      aria-pressed={selected}
                      className={cn(
                        "rounded-xl border px-2 py-3 text-center transition",
                        selected
                          ? "border-emerald-400/30 bg-emerald-400/[0.08] text-foreground"
                          : "border-white/10 bg-white/[0.025] text-foreground/80 hover:bg-white/[0.05]",
                      )}
                    >
                      <Clock className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium">{preset.label}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {format(preset.resolve(now), "EEE h:mm a")}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setChoice("custom")}
                aria-pressed={choice === "custom"}
                className={cn(
                  "mt-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                  choice === "custom"
                    ? "border-emerald-400/30 bg-emerald-400/[0.08]"
                    : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
                )}
              >
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">Pick a date &amp; time</span>
              </button>

              {choice === "custom" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Date
                    </span>
                    <input
                      type="date"
                      value={customDate}
                      min={format(now, "yyyy-MM-dd")}
                      onChange={(event) => setCustomDate(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Time
                    </span>
                    <input
                      type="time"
                      value={customTime}
                      onChange={(event) => setCustomTime(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
              )}

              {/* Live preview / validation / conflicts */}
              <div className="mt-4 min-h-[44px] rounded-xl border border-white/10 bg-black/15 p-3">
                {resolved.error ? (
                  <p className="flex items-center gap-2 text-xs text-red-200">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {resolved.error}
                  </p>
                ) : resolved.remindAt ? (
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-xs text-foreground">
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                      Returns {format(resolved.remindAt, "EEEE, MMM d")} at{" "}
                      {format(resolved.remindAt, "h:mm a")}
                      <span className="text-muted-foreground">· {getLocalTimeZone()}</span>
                    </p>
                    {conflicts.length > 0 && (
                      <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-2">
                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-200">
                          <AlertTriangle className="h-3 w-3" />
                          Near {conflicts.length} calendar event
                          {conflicts.length > 1 ? "s" : ""}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {conflicts.map((event) => (
                            <li key={event.id} className="text-[11px] text-foreground/75">
                              {format(new Date(`${event.date}T${event.time}`), "h:mm a")} ·{" "}
                              {event.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Choose when this message should return to your inbox.
                  </p>
                )}
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className={cn(
                    "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                    canConfirm
                      ? "bg-foreground text-background hover:opacity-90"
                      : "cursor-not-allowed bg-white/[0.06] text-muted-foreground",
                  )}
                >
                  {initialState ? "Update reminder" : "Snooze"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
