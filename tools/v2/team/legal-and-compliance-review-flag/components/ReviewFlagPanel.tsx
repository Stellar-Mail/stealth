import React from "react";
import { useReviewFlagForm } from "../hooks/useReviewFlagForm";
import { ReviewFlagForm } from "./ReviewFlagForm";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { SuccessState } from "./SuccessState";

export const ReviewFlagPanel: React.FC = () => {
  const { values, state, setField, submit, reset } = useReviewFlagForm();
  const disabled = state.status === "submitting";

  return (
    <section
      aria-labelledby="review-flag-heading"
      className="mx-auto flex max-w-xl flex-col gap-4 p-4"
    >
      <header>
        <h2 id="review-flag-heading" className="text-lg font-semibold text-gray-900">
          Legal &amp; Compliance Review Flag
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Raise a legal or compliance review flag for a mail resource. This surface is isolated to
          the tool folder and is not wired into the main app.
        </p>
      </header>

      <ReviewFlagForm
        values={values}
        disabled={disabled}
        onFieldChange={setField}
        onSubmit={submit}
      />

      <div aria-live="polite">
        {state.status === "idle" && <EmptyState />}
        {state.status === "submitting" && <LoadingState />}
        {state.status === "error" && <ErrorState error={state.error} onRetry={submit} />}
        {state.status === "success" && <SuccessState result={state.result} onReset={reset} />}
      </div>
    </section>
  );
};
