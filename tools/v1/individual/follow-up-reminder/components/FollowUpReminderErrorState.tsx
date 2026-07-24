import React from "react";

interface FollowUpReminderErrorStateProps {
  error?: string;
  onRetry?: () => void;
}

export const FollowUpReminderErrorState: React.FC<FollowUpReminderErrorStateProps> = ({
  error = "Unable to analyze email content. Please verify the email is selected and try again.",
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] px-4">
      <div
        className="bg-red-50 border border-red-200 p-5 rounded-lg max-w-md w-full"
        role="alert"
        aria-label="Error loading reminders"
      >
        <div className="flex items-start">
          <div className="flex-shrink-0 mt-0.5">
            <svg
              className="w-5 h-5 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div className="ml-3 w-full">
            <h3 className="text-red-800 font-medium text-base">Analysis Failed</h3>
            <p className="text-red-600 mt-1 text-sm">{error}</p>
            {onRetry && (
              <div className="mt-4">
                <button
                  onClick={onRetry}
                  className="px-3 py-1.5 bg-red-100 text-red-800 rounded-md text-sm font-medium hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-colors"
                  aria-label="Retry email analysis"
                >
                  Retry Analysis
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
