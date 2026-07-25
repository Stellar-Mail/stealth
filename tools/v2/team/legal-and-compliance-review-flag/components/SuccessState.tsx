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
        <dt className="text-gray-500">Flag ID</dt>
        <dd className="font-medium text-gray-900">{result.flagId}</dd>
        <dt className="text-gray-500">Status</dt>
        <dd className="font-medium text-gray-900">{result.status}</dd>
        <dt className="text-gray-500">Review state</dt>
        <dd className="font-medium text-gray-900">{result.reviewState}</dd>
        <dt className="text-gray-500">Raised at</dt>
        <dd className="font-medium text-gray-900">{new Date(result.timestamp).toISOString()}</dd>
      </dl>
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Audit trail</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-gray-600">
          {result.auditTrail.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </div>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
        >
          Raise another flag
        </button>
      )}
    </div>
  );
};
