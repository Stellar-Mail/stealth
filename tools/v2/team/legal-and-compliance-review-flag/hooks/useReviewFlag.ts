/**
 * Folder-local React hook for managing legal and compliance review flag state.
 */

import { useState, useCallback } from "react";
import type { ReviewFlagInput, ReviewFlagOutcome } from "../contract";
import type { ReviewFlagService } from "../services/review-flag-service";
import type { FlagState } from "../types";

export interface UseReviewFlagReturn {
  state: FlagState;
  submitFlag: (input: ReviewFlagInput) => Promise<ReviewFlagOutcome>;
  resetState: () => void;
}

export function useReviewFlag(service: ReviewFlagService): UseReviewFlagReturn {
  const [state, setState] = useState<FlagState>({
    isSubmitting: false,
    error: null,
    successResult: null,
  });

  const submitFlag = useCallback(
    async (input: ReviewFlagInput): Promise<ReviewFlagOutcome> => {
      setState({ isSubmitting: true, error: null, successResult: null });
      try {
        const outcome = await service.raiseFlag(input);
        if ("code" in outcome) {
          setState({
            isSubmitting: false,
            error: outcome.message,
            successResult: null,
          });
        } else {
          setState({
            isSubmitting: false,
            error: null,
            successResult: {
              flagId: outcome.flagId,
              status: outcome.status,
              timestamp: outcome.timestamp,
            },
          });
        }
        return outcome;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred";
        setState({
          isSubmitting: false,
          error: errorMsg,
          successResult: null,
        });
        return {
          code: "policy_conflict",
          message: errorMsg,
        };
      }
    },
    [service],
  );

  const resetState = useCallback(() => {
    setState({
      isSubmitting: false,
      error: null,
      successResult: null,
    });
  }, []);

  return {
    state,
    submitFlag,
    resetState,
  };
}
