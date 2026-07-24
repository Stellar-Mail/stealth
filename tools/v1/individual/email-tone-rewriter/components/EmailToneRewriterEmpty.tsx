import type { JSX } from "react";
import type { ToneId } from "../services/emailToneRewriter";
import { SUPPORTED_TONES } from "../services/emailToneRewriter";

export interface EmailToneRewriterEmptyProps {
  subject: string;
  bodyText: string;
  tone: ToneId;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onToneChange: (value: ToneId) => void;
  onSubmit: () => void;
}

const TONE_LABELS: Record<ToneId, string> = {
  concise: "Concise",
  friendly: "Friendly",
  formal: "Formal",
  apologetic: "Apologetic",
};

export function EmailToneRewriterEmpty({
  subject,
  bodyText,
  tone,
  onSubjectChange,
  onBodyChange,
  onToneChange,
  onSubmit,
}: EmailToneRewriterEmptyProps): JSX.Element {
  const canSubmit = bodyText.trim().length > 0;

  return (
    <section
      aria-labelledby="etr-title"
      aria-describedby="etr-help"
      role="region"
      className="etr-card"
    >
      <div className="etr-header">
        <p className="etr-eyebrow">Local draft tool</p>
        <h2 id="etr-title">Email Tone Rewriter</h2>
        <p id="etr-help">
          Paste a draft, choose a tone, then review the rewritten copy before using it anywhere
          else.
        </p>
      </div>

      <div className="etr-field">
        <label htmlFor="etr-subject">Subject</label>
        <input
          id="etr-subject"
          type="text"
          value={subject}
          onChange={(event) => onSubjectChange(event.target.value)}
          placeholder="Project follow-up"
          autoComplete="off"
        />
      </div>

      <fieldset className="etr-tone-group">
        <legend>Target tone</legend>
        {SUPPORTED_TONES.map((toneId) => (
          <label key={toneId} className="etr-tone-option">
            <input
              type="radio"
              name="etr-tone"
              value={toneId}
              checked={tone === toneId}
              onChange={() => onToneChange(toneId)}
            />
            <span>{TONE_LABELS[toneId]}</span>
          </label>
        ))}
      </fieldset>

      <div className="etr-field">
        <label htmlFor="etr-body">Draft body</label>
        <textarea
          id="etr-body"
          value={bodyText}
          onChange={(event) => onBodyChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              if (canSubmit) onSubmit();
            }
          }}
          aria-describedby="etr-body-hint"
          placeholder="Hey Sam, can you send the Q3 invoice by Friday?"
          rows={8}
        />
        <p id="etr-body-hint" className="etr-hint">
          Keyboard shortcut: Ctrl+Enter or Command+Enter rewrites when the draft body is not empty.
        </p>
      </div>

      <button type="button" onClick={onSubmit} disabled={!canSubmit} aria-disabled={!canSubmit}>
        Rewrite tone
      </button>
    </section>
  );
}
