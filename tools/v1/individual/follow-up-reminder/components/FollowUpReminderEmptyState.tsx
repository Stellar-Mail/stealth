import React from "react";

export const FollowUpReminderEmptyState: React.FC = () => {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[300px] text-center px-4"
      role="status"
      aria-live="polite"
      aria-label="No follow-up reminders"
    >
      <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-3">
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900">No Follow-Ups Needed</h3>
      <p className="text-gray-500 mt-1 max-w-sm">
        No actionable follow-up requests, deadlines, or reminders were found in the selected email.
      </p>
    </div>
  );
};
