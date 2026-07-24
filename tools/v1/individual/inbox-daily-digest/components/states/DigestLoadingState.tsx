import type { JSX } from "react";

export function DigestLoadingState(): JSX.Element {
  return (
    <div className="idd-panel idd-loading" aria-busy="true">
      <span className="idd-spinner" aria-hidden="true" />
      <p className="idd-state-label">Preparing</p>
      <h2>Building digest preview</h2>
      <p>Grouping recent mail, ranking important senders, and drafting next actions.</p>
    </div>
  );
}
