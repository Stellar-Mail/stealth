import type { JSX } from "react";

import type { DailyDigest } from "../InboxDailyDigestTool";

export interface DigestSuccessStateProps {
  digest: DailyDigest;
  tone: string;
  onReset: () => void;
  warnings?: string[];
}

export function DigestSuccessState({
  digest,
  tone,
  onReset,
  warnings,
}: DigestSuccessStateProps): JSX.Element {
  return (
    <article className="idd-panel idd-success" aria-labelledby="idd-result-title">
      <div className="idd-result-heading">
        <div>
          <p className="idd-state-label">{digest.dateLabel}</p>
          <h2 id="idd-result-title">{tone} digest</h2>
        </div>
        <button type="button" className="idd-secondary" onClick={onReset}>
          Clear
        </button>
      </div>

      <p className="idd-summary">{digest.summary}</p>

      {warnings && warnings.length > 0 && (
        <div
          className="idd-warnings-box"
          style={{
            background: "#fffaf0",
            border: "1px solid #feebc8",
            borderRadius: "6px",
            padding: "0.75rem",
            color: "#c05621",
            fontSize: "0.85rem",
          }}
        >
          <span style={{ fontWeight: 700, display: "block", marginBottom: "0.25rem" }}>
            Processing Notes ({warnings.length})
          </span>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <dl className="idd-insights" aria-label="Digest metrics">
        {digest.insights.map((insight) => (
          <div key={insight.id}>
            <dt>{insight.label}</dt>
            <dd>{insight.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="idd-top-email-title">
        <h3 id="idd-top-email-title">Top mail</h3>
        <ul className="idd-email-list">
          {digest.topEmails.map((email) => (
            <li key={email.id}>
              <span className={`idd-priority idd-priority-${email.priority}`}>
                {email.priority}
              </span>
              <div>
                <strong>{email.subject}</strong>
                <span>
                  {email.sender} at {email.receivedAt}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="idd-actions-title">
        <h3 id="idd-actions-title">Next actions</h3>
        <ol className="idd-next-actions">
          {digest.nextActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ol>
      </section>
    </article>
  );
}
