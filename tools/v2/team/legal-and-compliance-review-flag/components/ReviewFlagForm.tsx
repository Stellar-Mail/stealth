import React from "react";
import type { ReviewFlagFormValues } from "../ui-types";
import { SEVERITY_OPTIONS } from "../ui-types";

interface ReviewFlagFormProps {
  values: ReviewFlagFormValues;
  disabled: boolean;
  onFieldChange: <K extends keyof ReviewFlagFormValues>(
    field: K,
    value: ReviewFlagFormValues[K],
  ) => void;
  onSubmit: () => void;
}

const inputClass =
  "mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-gray-400";

export const ReviewFlagForm: React.FC<ReviewFlagFormProps> = ({
  values,
  disabled,
  onFieldChange,
  onSubmit,
}) => {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div>
        <label htmlFor="review-flag-reviewer" className="block text-sm font-medium text-foreground">
          Reviewer
        </label>
        <input
          id="review-flag-reviewer"
          name="reviewer"
          type="text"
          required
          value={values.reviewer}
          disabled={disabled}
          onChange={(event) => onFieldChange("reviewer", event.target.value)}
          className={inputClass}
          placeholder="reviewer:legal-001"
        />
      </div>

      <div>
        <label htmlFor="review-flag-resource" className="block text-sm font-medium text-foreground">
          Target resource
        </label>
        <input
          id="review-flag-resource"
          name="targetResource"
          type="text"
          required
          value={values.targetResource}
          disabled={disabled}
          onChange={(event) => onFieldChange("targetResource", event.target.value)}
          className={inputClass}
          placeholder="mail:thread:abc"
        />
      </div>

      <div>
        <label htmlFor="review-flag-reason" className="block text-sm font-medium text-foreground">
          Reason
        </label>
        <textarea
          id="review-flag-reason"
          name="flagReason"
          required
          rows={3}
          value={values.flagReason}
          disabled={disabled}
          onChange={(event) => onFieldChange("flagReason", event.target.value)}
          className={inputClass}
          placeholder="Describe why this resource needs legal or compliance review."
        />
      </div>

      <div>
        <label htmlFor="review-flag-severity" className="block text-sm font-medium text-foreground">
          Severity
        </label>
        <select
          id="review-flag-severity"
          name="severity"
          value={values.severity}
          disabled={disabled}
          onChange={(event) =>
            onFieldChange("severity", event.target.value as ReviewFlagFormValues["severity"])
          }
          className={inputClass}
        >
          {SEVERITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="review-flag-evidence" className="block text-sm font-medium text-foreground">
          Evidence references
        </label>
        <textarea
          id="review-flag-evidence"
          name="evidenceRefs"
          rows={2}
          value={values.evidenceRefs}
          disabled={disabled}
          onChange={(event) => onFieldChange("evidenceRefs", event.target.value)}
          className={inputClass}
          aria-describedby="review-flag-evidence-hint"
          placeholder="scan:vt-8821, ticket:sec-334"
        />
        <p id="review-flag-evidence-hint" className="mt-1 text-xs text-muted-foreground">
          Optional. Separate multiple references with a comma or a new line.
        </p>
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Raise review flag
      </button>
    </form>
  );
};
