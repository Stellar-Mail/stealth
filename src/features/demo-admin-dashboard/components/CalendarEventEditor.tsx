import { useMemo, useState } from "react";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEventEditorState, CalendarResponseState } from "../types/calendarEvent";
import { CALENDAR_RESPONSE_STATES, getResponseStateOption } from "../types/calendarEvent";
import { validateCalendarEventEditor } from "../calendarEventValidation";
import { ValidationResultsPanel } from "../ValidationResultsPanel";
import type { ValidationIssue } from "../validation-types";

export interface CalendarEventEditorProps {
  state: CalendarEventEditorState;
  onChange: (state: CalendarEventEditorState) => void;
  onSave?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function prepareAttendees(input: string): string[] {
  return input
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

export function formatAttendeesDisplay(attendees: string[]): string {
  return attendees.join(", ");
}

export function CalendarEventEditor({
  state,
  onChange,
  onSave,
  onCancel,
  className,
}: CalendarEventEditorProps) {
  const [attendeesInput, setAttendeesInput] = useState(() =>
    formatAttendeesDisplay(state.attendees),
  );

  const issues = useMemo(() => validateCalendarEventEditor(state), [state]);
  const hasErrors = issues.some((i) => i.severity === "error");

  const fieldIssues = (field: string): ValidationIssue[] =>
    issues.filter((i) => i.fieldPath === field || i.fieldPath.startsWith(`${field}[`));

  const titleIssues = fieldIssues("title");
  const startTimeIssues = fieldIssues("startTime");
  const endTimeIssues = fieldIssues("endTime");
  const attendeeIssues = issues.filter(
    (i) => i.fieldPath.startsWith("attendees[") || i.fieldPath === "attendees",
  );

  const handleAttendeesChange = (value: string) => {
    setAttendeesInput(value);
    onChange({ ...state, attendees: prepareAttendees(value) });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSave && !hasErrors) {
      e.preventDefault();
      onSave();
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4",
        className,
      )}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold text-foreground">Edit Calendar Event</h4>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel editing"
            className="rounded-md p-1 text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="cal-title" className="text-xs font-medium text-muted-foreground">
          Event Title *
        </label>
        <input
          id="cal-title"
          type="text"
          value={state.title}
          onChange={(e) => onChange({ ...state, title: e.target.value })}
          placeholder="e.g. Design Review"
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none bg-black/40",
            titleIssues.length > 0
              ? "border-red-500/50 focus:border-red-400"
              : "border-white/[0.08] focus:border-white/20",
          )}
          required
        />
        {titleIssues.length > 0 && (
          <p className="text-xs font-medium text-rose-400">{titleIssues[0].message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="cal-start" className="text-xs font-medium text-muted-foreground">
            Start Date & Time *
          </label>
          <input
            id="cal-start"
            type="datetime-local"
            value={state.startTime}
            onChange={(e) => onChange({ ...state, startTime: e.target.value })}
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-xs text-foreground focus:outline-none bg-black/40",
              startTimeIssues.length > 0
                ? "border-red-500/50 focus:border-red-400"
                : "border-white/[0.08] focus:border-white/20",
            )}
            required
          />
          {startTimeIssues.length > 0 && (
            <p className="text-xs font-medium text-rose-400">{startTimeIssues[0].message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="cal-end" className="text-xs font-medium text-muted-foreground">
            End Date & Time *
          </label>
          <input
            id="cal-end"
            type="datetime-local"
            value={state.endTime}
            onChange={(e) => onChange({ ...state, endTime: e.target.value })}
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-xs text-foreground focus:outline-none bg-black/40",
              endTimeIssues.length > 0
                ? "border-red-500/50 focus:border-red-400"
                : "border-white/[0.08] focus:border-white/20",
            )}
            required
          />
          {endTimeIssues.length > 0 && (
            <p className="text-xs font-medium text-rose-400">{endTimeIssues[0].message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="cal-location" className="text-xs font-medium text-muted-foreground">
          Location
        </label>
        <input
          id="cal-location"
          type="text"
          value={state.location}
          onChange={(e) => onChange({ ...state, location: e.target.value })}
          placeholder="e.g. Conference Room A"
          className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none bg-black/40 focus:border-white/20"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="cal-attendees" className="text-xs font-medium text-muted-foreground">
          Attendees (comma-separated)
        </label>
        <input
          id="cal-attendees"
          type="text"
          value={attendeesInput}
          onChange={(e) => handleAttendeesChange(e.target.value)}
          placeholder="e.g. eve@stealth.xyz, lina@vantage.studio"
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none bg-black/40",
            attendeeIssues.length > 0
              ? "border-red-500/50 focus:border-red-400"
              : "border-white/[0.08] focus:border-white/20",
          )}
        />
        {attendeeIssues.length > 0 && (
          <p className="text-xs font-medium text-rose-400">{attendeeIssues[0].message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="cal-response" className="text-xs font-medium text-muted-foreground">
          Response State
        </label>
        <select
          id="cal-response"
          value={state.responseState}
          onChange={(e) =>
            onChange({ ...state, responseState: e.target.value as CalendarResponseState })
          }
          className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-foreground focus:outline-none bg-black/40 focus:border-white/20"
        >
          {CALENDAR_RESPONSE_STATES.map((rs) => {
            const opt = getResponseStateOption(rs);
            return (
              <option key={rs} value={rs}>
                {opt.label}
              </option>
            );
          })}
        </select>
        <p className="text-[10px] text-muted-foreground">
          {getResponseStateOption(state.responseState).description}
        </p>
      </div>

      {issues.length > 0 && (
        <ValidationResultsPanel issues={issues} title="Calendar event validation" />
      )}

      {(onSave || onCancel) && (
        <div className="flex justify-end gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-white/[0.08] bg-white/[0.01] px-4 py-2 text-xs font-medium text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
            >
              Cancel
            </button>
          )}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={hasErrors}
              className={cn(
                "rounded-lg px-4 py-2 text-xs font-semibold transition",
                hasErrors
                  ? "cursor-not-allowed bg-white/[0.04] text-muted-foreground"
                  : "bg-foreground text-background hover:opacity-90",
              )}
            >
              Save
            </button>
          )}
        </div>
      )}
    </div>
  );
}
