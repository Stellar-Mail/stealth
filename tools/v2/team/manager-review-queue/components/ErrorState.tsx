import React from "react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = "An error occurred while loading the review queue.",
  onRetry,
}) => {
  return (
    <div
      className="flex flex-col items-center justify-center p-8 text-center border border-red-200 rounded-lg bg-red-50"
      role="alert"
      aria-live="assertive"
    >
      <svg
        className="w-10 h-10 text-red-500 mb-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h3 className="text-lg font-medium text-red-800">Error Loading Queue</h3>
      <p className="mt-2 text-sm text-red-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          aria-label="Retry loading review queue"
        >
          Try Again
        </button>
      )}
    </div>
  );
};
