import React from "react";

export const LoadingState: React.FC = () => {
  return (
    <div
      className="flex flex-col items-center justify-center p-12 text-center"
      role="status"
      aria-live="polite"
    >
      <div
        className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"
        aria-hidden="true"
      />
      <h3 className="text-lg font-medium text-gray-900">Loading Review Queue...</h3>
      <span className="sr-only">Please wait while we load the review items.</span>
    </div>
  );
};
