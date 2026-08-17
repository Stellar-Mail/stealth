import React, { useState } from "react";
import type {
  ReminderReviewModel,
  ReminderConfidence,
  ReminderState,
} from "../services/followUpReminder";

const CONFIDENCE_META: Record<
  ReminderConfidence,
  { label: string; bg: string; text: string; dot: string }
> = {
  high: { label: "High", bg: "bg-green-50", text: "text-green-800", dot: "bg-green-500" },
  medium: { label: "Medium", bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-500" },
  low: { label: "Low", bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400" },
};

const SIGNAL_LABELS: Record<string, string> = {
  explicit_request: "Explicit Request",
  absolute_date: "Absolute Date",
  relative_date: "Relative Date",
  sender_hint: "Sender Hint",
  low_confidence_context: "Low Confidence",
};

function formatDueDate(iso: string | null): string {
  if (!iso) return "No due date set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface FollowUpReminderCardProps {
  reminder: ReminderReviewModel;
  onConfirm?: (id: string) => void;
  onSnooze?: (id: string) => void;
  onComplete?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onEditDueDate?: (id: string, newDate: string) => void;
}

export const FollowUpReminderCard: React.FC<FollowUpReminderCardProps> = ({
  reminder,
  onConfirm,
  onSnooze,
  onComplete,
  onDismiss,
  onEditDueDate,
}) => {
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(reminder.dueAt ?? "");

  const meta = CONFIDENCE_META[reminder.confidence];

  const handleEditSave = () => {
    if (onEditDueDate && editDate) {
      onEditDueDate(reminder.sourceMessageId, editDate);
    }
    setEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleEditSave();
    } else if (e.key === "Escape") {
      setEditing(false);
      setEditDate(reminder.dueAt ?? "");
    }
  };

  return (
    <div
      className="p-5 border border-indigo-200 rounded-lg bg-white shadow-sm hover:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 outline-none transition-all"
      tabIndex={0}
      aria-label={`Reminder: ${reminder.title}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.bg} ${meta.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
              {meta.label}
            </span>
            <span className="text-xs text-gray-400 font-mono">
              {reminder.state === "draft" ? "Draft" : "No Action"}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 text-base truncate">{reminder.title}</h3>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
        <div className="flex items-center gap-1.5 text-gray-600">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Edit due date"
                autoFocus
              />
              <button
                onClick={handleEditSave}
                className="px-2 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Save due date"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditDate(reminder.dueAt ?? "");
                }}
                className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                aria-label="Cancel editing due date"
              >
                Cancel
              </button>
            </div>
          ) : (
            <span>
              Due {formatDueDate(reminder.dueAt)}
              {reminder.dueAt && (
                <span className="ml-1 text-gray-400 text-xs">
                  ({new Date(reminder.dueAt).toLocaleDateString("en-CA")})
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {reminder.signals.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3" role="list" aria-label="Detected signals">
          {reminder.signals.map((signal, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700"
              role="listitem"
            >
              {SIGNAL_LABELS[signal.type] ?? signal.type}
            </span>
          ))}
        </div>
      )}

      {reminder.warnings.length > 0 && (
        <div className="mb-3 space-y-1">
          {reminder.warnings.map((warning, idx) => (
            <p
              key={idx}
              className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded"
              role="alert"
            >
              <svg
                className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {warning}
            </p>
          ))}
        </div>
      )}

      <div
        className="flex flex-wrap gap-2 pt-2 border-t border-gray-100"
        role="group"
        aria-label="Reminder actions"
      >
        {reminder.state === "draft" && onConfirm && (
          <button
            onClick={() => onConfirm(reminder.sourceMessageId)}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            aria-label="Confirm reminder"
          >
            Confirm
          </button>
        )}
        {reminder.state === "draft" && onSnooze && (
          <button
            onClick={() => onSnooze(reminder.sourceMessageId)}
            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            aria-label="Snooze reminder"
          >
            Snooze
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          aria-label="Edit reminder due date"
        >
          Edit
        </button>
        {onComplete && (
          <button
            onClick={() => onComplete(reminder.sourceMessageId)}
            className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            aria-label="Mark reminder complete"
          >
            Complete
          </button>
        )}
        {onDismiss && (
          <button
            onClick={() => onDismiss(reminder.sourceMessageId)}
            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-500 rounded-md text-sm font-medium hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            aria-label="Dismiss reminder"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};
