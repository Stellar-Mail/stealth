import type { JSX } from "react";
import type { RewriterErrorCode } from "../services/emailToneRewriter";

export interface EmailToneRewriterErrorProps {
  code: RewriterErrorCode;
  message: string;
  onRetry?: () => void;
}

export function EmailToneRewriterError({
  code,
  message,
  onRetry,
}: EmailToneRewriterErrorProps): JSX.Element {
  return (
    <section className="etr-card etr-error" role="alert" aria-labelledby="etr-error-title">
      <p className="etr-eyebrow">{code}</p>
      <h2 id="etr-error-title">Unable to rewrite tone</h2>
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </section>
  );
}
