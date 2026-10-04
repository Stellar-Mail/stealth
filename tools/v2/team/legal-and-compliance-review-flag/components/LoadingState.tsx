import React from "react";

export const LoadingState: React.FC = () => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center p-6 text-center"
    >
      <span
        aria-hidden="true"
        className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-border border-t-gray-700"
      />
      <p className="text-sm font-medium text-foreground">Raising review flag...</p>
      <p className="mt-1 text-sm text-muted-foreground">Please wait while the flag is validated.</p>
    </div>
  );
};
