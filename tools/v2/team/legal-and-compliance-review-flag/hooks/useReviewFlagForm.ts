import { useCallback, useState } from "react";
import {
  createReviewFlag,
  isReviewFlagError,
  type ReviewFlagDependency,
  type ReviewFlagInput,
} from "../contract";
import {
  INITIAL_FORM_VALUES,
  type ReviewFlagFormValues,
  type ReviewFlagSubmitState,
} from "../ui-types";

/**
 * In-memory dependency for the isolated demo surface. It authorizes any
 * non-empty reviewer, treats every resource as existing, and never reports a
 * duplicate, so the form exercises the success and validation paths without a
 * backend. A future integration issue can swap in a real ReviewFlagDependency.
 */
function createDemoDependency(): ReviewFlagDependency {
  let counter = 0;
  return {
    resolveReviewer: (reviewer: string) => reviewer.trim().length > 0,
    resourceExists: () => true,
    findExistingFlag: () => null,
    persistFlag: () => undefined,
    now: () => Date.now(),
    generateId: () => {
      counter += 1;
      return "flag-" + counter.toString().padStart(4, "0");
    },
  };
}

function parseEvidenceRefs(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((ref) => ref.trim())
    .filter((ref) => ref.length > 0);
}

export function useReviewFlagForm(): {
  values: ReviewFlagFormValues;
  state: ReviewFlagSubmitState;
  setField: <K extends keyof ReviewFlagFormValues>(
    field: K,
    value: ReviewFlagFormValues[K],
  ) => void;
  submit: () => void;
  reset: () => void;
} {
  const [values, setValues] = useState<ReviewFlagFormValues>(INITIAL_FORM_VALUES);
  const [state, setState] = useState<ReviewFlagSubmitState>({ status: "idle" });

  const setField = useCallback(
    <K extends keyof ReviewFlagFormValues>(field: K, value: ReviewFlagFormValues[K]) => {
      setValues((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const submit = useCallback(() => {
    setState({ status: "submitting" });

    const evidenceRefs = parseEvidenceRefs(values.evidenceRefs);
    const input: ReviewFlagInput = {
      reviewer: values.reviewer,
      targetResource: values.targetResource,
      flagReason: values.flagReason,
      severity: values.severity,
      ...(evidenceRefs.length > 0 ? { evidenceRefs } : {}),
    };

    void createReviewFlag(input, createDemoDependency())
      .then((outcome) => {
        if (isReviewFlagError(outcome)) {
          setState({ status: "error", error: outcome });
        } else {
          setState({ status: "success", result: outcome });
        }
      })
      .catch(() => {
        setState({
          status: "error",
          error: { code: "policy_conflict", message: "Unexpected error while raising the flag." },
        });
      });
  }, [values]);

  const reset = useCallback(() => {
    setValues(INITIAL_FORM_VALUES);
    setState({ status: "idle" });
  }, []);

  return { values, state, setField, submit, reset };
}
