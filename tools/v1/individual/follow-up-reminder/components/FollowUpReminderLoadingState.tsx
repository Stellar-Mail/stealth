import React from "react";

export const FollowUpReminderLoadingState: React.FC = () => {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[300px]"
      role="status"
      aria-busy="true"
      aria-label="Analyzing email for follow-up reminders"
    >
      <div
        className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"
        role="presentation"
      />
      <span className="text-indigo-600 font-medium">Analyzing email content...</span>
      <p className="text-sm text-gray-500 mt-2">Scanning for follow-up requests and due dates.</p>
    </div>
  );
};
