import React, { useState, useCallback } from "react";
import type { ReminderReviewModel } from "../services/followUpReminder";
import { buildFollowUpReminder } from "../services/followUpReminder";
import { sampleEmailList } from "../services/fixtures";
import { FollowUpReminderCard } from "./FollowUpReminderCard";
import { FollowUpReminderEmptyState } from "./FollowUpReminderEmptyState";
import { FollowUpReminderErrorState } from "./FollowUpReminderErrorState";
import { FollowUpReminderLoadingState } from "./FollowUpReminderLoadingState";

type ToolState = "idle" | "loading" | "success" | "error" | "empty";

export const FollowUpReminder: React.FC = () => {
  const [state, setState] = useState<ToolState>("idle");
  const [reminders, setReminders] = useState<ReminderReviewModel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = useCallback(() => {
    setState("loading");
    setError(null);
    setTimeout(() => {
      try {
        const results = sampleEmailList.map((email) => buildFollowUpReminder(email));
        const actionable = results.filter((r) => r.state === "draft");
        if (actionable.length === 0) {
          setState("empty");
          setReminders([]);
        } else {
          setState("success");
          setReminders(actionable);
        }
      } catch {
        setState("error");
        setError("An unexpected error occurred while processing email content.");
      }
    }, 1200);
  }, []);

  const handleSimulateEmpty = useCallback(() => {
    setState("empty");
    setReminders([]);
    setError(null);
  }, []);

  const handleSimulateError = useCallback(() => {
    setState("error");
    setReminders([]);
    setError("Connection lost. Unable to reach the email analysis service.");
  }, []);

  const handleSimulateSuccess = useCallback(() => {
    const results = sampleEmailList.map((email) => buildFollowUpReminder(email));
    const actionable = results.filter((r) => r.state === "draft");
    setState("success");
    setReminders(actionable);
    setError(null);
  }, []);

  const handleRetry = useCallback(() => {
    handleLoad();
  }, [handleLoad]);

  const handleConfirm = useCallback((id: string) => {
    setReminders((prev) =>
      prev.map((r) =>
        r.sourceMessageId === id ? { ...r, warnings: [...r.warnings, "Reminder confirmed."] } : r,
      ),
    );
  }, []);

  const handleSnooze = useCallback((id: string) => {
    setReminders((prev) =>
      prev.map((r) =>
        r.sourceMessageId === id
          ? { ...r, warnings: [...r.warnings, "Snoozed until tomorrow."] }
          : r,
      ),
    );
  }, []);

  const handleComplete = useCallback((id: string) => {
    setReminders((prev) => {
      const filtered = prev.filter((r) => r.sourceMessageId !== id);
      if (filtered.length === 0) {
        setState("empty");
      }
      return filtered;
    });
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setReminders((prev) => {
      const filtered = prev.filter((r) => r.sourceMessageId !== id);
      if (filtered.length === 0) {
        setState("empty");
      }
      return filtered;
    });
  }, []);

  const handleEditDueDate = useCallback((id: string, newDate: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.sourceMessageId === id ? { ...r, dueAt: newDate } : r)),
    );
  }, []);

  const activeCount = reminders.length;

  return (
    <div
      className="p-6 border rounded-xl max-w-3xl mx-auto bg-white shadow-sm"
      role="region"
      aria-labelledby="follow-up-reminder-heading"
    >
      <header className="mb-6 border-b pb-4">
        <div className="flex items-center gap-3 mb-1">
          <svg
            className="w-6 h-6 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <h2 className="text-2xl font-semibold text-gray-800" id="follow-up-reminder-heading">
            Follow-up Reminder
          </h2>
        </div>
        <p className="text-sm text-gray-500 ml-9">
          Detect follow-up requests, deadlines, and action items from email content.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Demo state controls">
        <button
          onClick={handleLoad}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "loading"}
        >
          Analyze Emails
        </button>
        <button
          onClick={handleSimulateEmpty}
          className="px-4 py-2 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "empty"}
        >
          No Reminders Found
        </button>
        <button
          onClick={handleSimulateError}
          className="px-4 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "error"}
        >
          Simulate Error
        </button>
        <button
          onClick={handleSimulateSuccess}
          className="px-4 py-2 bg-green-50 text-green-700 rounded-md hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors font-medium text-sm"
          aria-pressed={state === "success"}
        >
          Show Success
        </button>
      </div>

      <div
        aria-live="polite"
        aria-atomic="true"
        className="min-h-[300px] bg-gray-50 rounded-lg border border-gray-100 p-4"
      >
        {state === "idle" && (
          <div className="flex items-center justify-center h-full min-h-[250px]">
            <div className="text-center">
              <svg
                className="w-12 h-12 text-gray-300 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <p className="text-gray-500 text-center">
                Select <span className="font-medium">Analyze Emails</span> to detect follow-up
                reminders.
              </p>
            </div>
          </div>
        )}

        {state === "loading" && <FollowUpReminderLoadingState />}

        {state === "empty" && <FollowUpReminderEmptyState />}

        {state === "error" && (
          <FollowUpReminderErrorState error={error ?? undefined} onRetry={handleRetry} />
        )}

        {state === "success" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2 px-2">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                {activeCount} {activeCount === 1 ? "Reminder" : "Reminders"} Found
              </span>
            </div>
            <ul className="space-y-3" aria-label="Follow-up reminder list">
              {reminders.map((reminder) => (
                <li key={reminder.sourceMessageId}>
                  <FollowUpReminderCard
                    reminder={reminder}
                    onConfirm={handleConfirm}
                    onSnooze={handleSnooze}
                    onComplete={handleComplete}
                    onDismiss={handleDismiss}
                    onEditDueDate={handleEditDueDate}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
