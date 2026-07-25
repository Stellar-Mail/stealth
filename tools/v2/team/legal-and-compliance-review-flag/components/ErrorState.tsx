import React from "react";
import type { ReviewFlagError } from "../contract";

interface ErrorStateProps {
  error: ReviewFlagError;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  const fields = error.code === "invalid_input" ? error.fields : undefined;

  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-semibold text-red-800">Could not raise the flag</p>
      <p className="mt-1 text-sm text-red-700">{error.message}</p>
      <p className="mt-2 text-xs uppercase tracking-wide text-red-500">Code: {error.code}</p>
      {fields && fields.length > 0 && (
        <p className="mt-1 text-xs text-red-600">Check these fields: {fields.join(", ")}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Try again
        </button>
      )}
    </div>
  );
};
