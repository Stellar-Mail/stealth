import React from "react";

export const LoadingState: React.FC = () => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      <span
        aria-hidden="true"
        className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700"
      />
      <p className="text-base font-medium text-gray-900">Assigning meetings...</p>
      <p className="text-sm text-gray-500">
        Please wait while we match meetings to available team members.
      </p>
    </div>
  );
};
