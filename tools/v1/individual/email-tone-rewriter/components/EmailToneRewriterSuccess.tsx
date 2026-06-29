import type { JSX } from "react";
import type { ToneRewrite } from "../services/emailToneRewriter";

export interface EmailToneRewriterSuccessProps {
  rewrite: ToneRewrite;
  onReset?: () => void;
}

export function EmailToneRewriterSuccess({
  rewrite,
  onReset,
}: EmailToneRewriterSuccessProps): JSX.Element {
  return (
    <article className="etr-card" aria-labelledby="etr-success-title">
      <header className="etr-header">
        <p className="etr-eyebrow" aria-live="polite">
          {rewrite.wordCount} words · {rewrite.tone} tone
        </p>
        <h2 id="etr-success-title">Rewritten draft ready for review</h2>
        <p>No send, save, or mailbox mutation actions are available in this isolated tool.</p>
      </header>

      <section aria-label="Rewritten email body" className="etr-output" tabIndex={0}>
        {rewrite.rewrittenBody}
      </section>

      <section aria-label="Preserved key points">
        <h3>Preserved key points</h3>
        {rewrite.preservedKeyPoints.length > 0 ? (
          <ul>
            {rewrite.preservedKeyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : (
          <p>No dates, links, amounts, or named anchors were detected.</p>
        )}
      </section>

      <dl className="etr-meta">
        <div>
          <dt>Changed</dt>
          <dd>{rewrite.changed ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Truncated</dt>
          <dd>{rewrite.truncated ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Actions</dt>
          <dd>Send disabled; save disabled; mutate disabled</dd>
        </div>
      </dl>

      {onReset && (
        <button type="button" onClick={onReset}>
          Rewrite another draft
        </button>
      )}
    </article>
  );
}
