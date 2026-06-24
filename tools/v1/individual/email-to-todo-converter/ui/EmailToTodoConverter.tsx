import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  buildTaskDraft,
  describeConverter,
  hasConvertibleContent,
  type ConverterStatus,
  type EmailToTodoConverterProps,
  type TaskDraft,
} from "./emailToTodoView";

interface ConverterState {
  status: ConverterStatus;
  draft: TaskDraft | null;
  errorMessage: string;
}

type ConverterAction =
  | { type: "reset"; hasEmail: boolean }
  | { type: "convert-start" }
  | { type: "convert-success"; draft: TaskDraft }
  | { type: "convert-error"; message: string };

function converterReducer(state: ConverterState, action: ConverterAction): ConverterState {
  switch (action.type) {
    case "reset":
      return { status: action.hasEmail ? "ready" : "empty", draft: null, errorMessage: "" };
    case "convert-start":
      return { status: "loading", draft: null, errorMessage: "" };
    case "convert-success":
      return { status: "success", draft: action.draft, errorMessage: "" };
    case "convert-error":
      return { status: "error", draft: null, errorMessage: action.message };
    default:
      return state;
  }
}

export function EmailToTodoConverter(props: EmailToTodoConverterProps) {
  const { email, onSaveDraft, idPrefix = "email-to-todo" } = props;
  const hasEmail = hasConvertibleContent(email);

  const [state, dispatch] = useReducer(converterReducer, {
    status: hasConvertibleContent(email) ? "ready" : "empty",
    draft: null,
    errorMessage: "",
  });

  const draftHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  // Reset the converter whenever a different email is selected.
  useEffect(() => {
    dispatch({ type: "reset", hasEmail: hasConvertibleContent(email) });
  }, [email]);

  // Move focus to the most relevant region after a state change.
  useEffect(() => {
    if (state.status === "success") {
      draftHeadingRef.current?.focus();
    } else if (state.status === "error") {
      errorRef.current?.focus();
    }
  }, [state.status]);

  const handleConvert = useCallback(() => {
    if (!hasConvertibleContent(email)) {
      dispatch({ type: "convert-error", message: "Select an email with a subject or body first." });
      return;
    }
    dispatch({ type: "convert-start" });
    try {
      dispatch({ type: "convert-success", draft: buildTaskDraft(email) });
    } catch {
      dispatch({ type: "convert-error", message: "Conversion failed. Please try another email." });
    }
  }, [email]);

  const handleSave = useCallback(() => {
    if (state.draft && onSaveDraft) {
      onSaveDraft(state.draft);
    }
  }, [state.draft, onSaveDraft]);

  const view = describeConverter({ status: state.status, hasEmail });
  const statusRegionId = idPrefix + "-status";

  return (
    <section
      className="email-to-todo-converter"
      aria-labelledby={idPrefix + "-heading"}
      aria-busy={view.isBusy}
    >
      <h2 id={idPrefix + "-heading"} className="email-to-todo-converter__title">
        Email to task converter
      </h2>

      <p
        id={statusRegionId}
        className="email-to-todo-converter__status"
        role="status"
        aria-live="polite"
      >
        {view.statusMessage}
      </p>

      {email ? (
        <dl className="email-to-todo-converter__source">
          <div className="email-to-todo-converter__source-row">
            <dt>Subject</dt>
            <dd>{email.subject || "(no subject)"}</dd>
          </div>
          <div className="email-to-todo-converter__source-row">
            <dt>From</dt>
            <dd>{email.sender || "(unknown sender)"}</dd>
          </div>
          <div className="email-to-todo-converter__source-row">
            <dt>Received</dt>
            <dd>{email.receivedAt || "(unknown)"}</dd>
          </div>
        </dl>
      ) : null}

      {view.showEmptyState ? (
        <p className="email-to-todo-converter__empty">
          No email is selected yet. Choose an email to begin.
        </p>
      ) : null}

      <div className="email-to-todo-converter__actions">
        <button
          type="button"
          className="email-to-todo-converter__convert"
          onClick={handleConvert}
          disabled={!view.canConvert}
          aria-describedby={statusRegionId}
        >
          Convert to task draft
        </button>
      </div>

      {view.isBusy ? (
        <p className="email-to-todo-converter__loading" role="status" aria-live="polite">
          Converting...
        </p>
      ) : null}

      {view.showError ? (
        <div className="email-to-todo-converter__error" role="alert" tabIndex={-1} ref={errorRef}>
          {state.errorMessage}
        </div>
      ) : null}

      {view.showDraft && state.draft ? (
        <article
          className="email-to-todo-converter__draft"
          aria-labelledby={idPrefix + "-draft-heading"}
        >
          <h3
            id={idPrefix + "-draft-heading"}
            className="email-to-todo-converter__draft-heading"
            tabIndex={-1}
            ref={draftHeadingRef}
          >
            Review task draft
          </h3>

          <div className="email-to-todo-converter__field">
            <label htmlFor={idPrefix + "-title"}>Title</label>
            <input id={idPrefix + "-title"} type="text" defaultValue={state.draft.title} readOnly />
          </div>

          <div className="email-to-todo-converter__field">
            <label htmlFor={idPrefix + "-notes"}>Notes</label>
            <textarea id={idPrefix + "-notes"} defaultValue={state.draft.notes} readOnly />
          </div>

          <div className="email-to-todo-converter__field">
            <label htmlFor={idPrefix + "-due"}>Suggested due date</label>
            <input
              id={idPrefix + "-due"}
              type="text"
              defaultValue={state.draft.suggestedDueDate}
              readOnly
            />
          </div>

          <div className="email-to-todo-converter__field">
            <label htmlFor={idPrefix + "-priority"}>Suggested priority</label>
            <input
              id={idPrefix + "-priority"}
              type="text"
              defaultValue={state.draft.suggestedPriority}
              readOnly
            />
          </div>

          <p className="email-to-todo-converter__hint">
            Review the draft above. Saving is intentionally not wired up in this isolated tool.
          </p>

          <div className="email-to-todo-converter__actions">
            <button
              type="button"
              className="email-to-todo-converter__save"
              onClick={handleSave}
              disabled={!onSaveDraft}
            >
              Save task draft
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
