import type { JSX } from "react";
import type { RewriterState, ToneId } from "../services/emailToneRewriter";
import { EmailToneRewriterEmpty } from "./EmailToneRewriterEmpty";
import { EmailToneRewriterError } from "./EmailToneRewriterError";
import { EmailToneRewriterLoading } from "./EmailToneRewriterLoading";
import { EmailToneRewriterSuccess } from "./EmailToneRewriterSuccess";

export interface EmailToneRewriterProps {
  state: RewriterState;
  subject: string;
  bodyText: string;
  tone: ToneId;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onToneChange: (value: ToneId) => void;
  onSubmit: () => void;
  onRetry?: () => void;
  onReset?: () => void;
}

export function EmailToneRewriter(props: EmailToneRewriterProps): JSX.Element {
  switch (props.state.status) {
    case "idle":
      return <EmailToneRewriterEmpty {...props} />;
    case "loading":
      return <EmailToneRewriterLoading />;
    case "error":
      return (
        <EmailToneRewriterError
          code={props.state.code}
          message={props.state.message}
          onRetry={props.onRetry}
        />
      );
    case "ready":
      return <EmailToneRewriterSuccess rewrite={props.state.rewrite} onReset={props.onReset} />;
  }
}
