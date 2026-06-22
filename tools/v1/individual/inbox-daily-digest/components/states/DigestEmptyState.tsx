import type { JSX } from "react";

export function DigestEmptyState(): JSX.Element {
  return (
    <div className="idd-panel idd-empty">
      <p className="idd-state-label">Ready</p>
      <h2>No digest generated yet</h2>
      <p>
        Choose the digest scope and generate a local preview. This state avoids assuming a mailbox
        connection before the tool is integrated.
      </p>
    </div>
  );
}
