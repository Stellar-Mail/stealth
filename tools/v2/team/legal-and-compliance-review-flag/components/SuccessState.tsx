import React from "react";
import type { ReviewFlagResult } from "../contract";

interface SuccessStateProps {
  result: ReviewFlagResult;
  onReset?: () => void;
}

export const SuccessState: React.FC<SuccessStateProps> = ({ result, onReset }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-green-200 bg-green-50 p-6"
    >
      <p className="text-sm font-semibold text-green-800">Review flag raised</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">Flag ID</dt>
        <dd className="font-medium text-foreground">{result.flagId}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd className="font-medium text-foreground">{result.status}</dd>
        <dt className="text-muted-foreground">Review state</dt>
        <dd className="font-medium text-foreground">{result.reviewState}</dd>
        <dt className="text-muted-foreground">Raised at</dt>
        <dd className="font-medium text-foreground">{new Date(result.timestamp).toISOString()}</dd>
      </dl>
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Audit trail
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {result.auditTrail.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </div>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
        >
          Raise another flag
        </button>
      )}
    </div>
  );
};
