import React from "react";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <section role="alert" className="rounded-xl border border-destructive p-6">
      <h2 className="text-base font-semibold">Unable to load workload data</h2>

      <p className="mt-2 text-sm text-muted-foreground">{message}</p>

      <button type="button" onClick={onRetry} className="mt-4 rounded-md bg-primary px-4 py-2">
        Retry
      </button>
    </section>
  );
}
