import type { JSX } from "react";

export interface DigestErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function DigestErrorState({ message, onRetry }: DigestErrorStateProps): JSX.Element {
  return (
    <div className="idd-panel idd-error" role="alert">
      <p className="idd-state-label">Needs attention</p>
      <h2>Digest unavailable</h2>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        Retry preview
      </button>
    </div>
  );
}
