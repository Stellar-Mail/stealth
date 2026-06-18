import { CalendarClock, RotateCcw } from "lucide-react";
import type { SnoozeState } from "@/components/mail/data";
import { formatSnoozeSummary, isSnoozeDue } from "./types";

/**
 * Shown at the top of a snoozed message. Surfaces clear reminder metadata and
 * the two affordances the snoozed folder needs: edit (reopen the dialog) and
 * undo / return to inbox now.
 */
export function SnoozeBanner({
  state,
  onEdit,
  onUnsnooze,
}: {
  state: SnoozeState;
  onEdit: () => void;
  onUnsnooze: () => void;
}) {
  const due = isSnoozeDue(state);

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-sky-300/15 bg-sky-300/[0.04] p-4">
      <CalendarClock className="h-4 w-4 shrink-0 text-sky-200" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {due ? "Reminder is due" : formatSnoozeSummary(state)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {due
            ? "This message is ready to return to your inbox."
            : "We'll bring this back to your inbox then."}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
        >
          Edit
        </button>
        <button
          onClick={onUnsnooze}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition hover:opacity-90"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Unsnooze
        </button>
      </div>
    </div>
  );
}
