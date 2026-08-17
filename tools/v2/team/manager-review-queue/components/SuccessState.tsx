import React from "react";

interface SuccessStateProps {
  message?: string;
  onDismiss?: () => void;
}

export const SuccessState: React.FC<SuccessStateProps> = ({
  message = "Action completed successfully.",
  onDismiss,
}) => {
  return (
    <div
      className="flex flex-col items-center justify-center p-8 text-center border border-green-200 rounded-lg bg-green-50"
      role="status"
      aria-live="polite"
    >
      <svg
        className="w-10 h-10 text-green-500 mb-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h3 className="text-lg font-medium text-green-800">Success</h3>
      <p className="mt-2 text-sm text-green-600">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="mt-4 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
          aria-label="Dismiss success message"
        >
          Dismiss
        </button>
      )}
    </div>
  );
};
