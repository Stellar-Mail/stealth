/**
 * Service boundary for the Legal & Compliance Review Flag tool.
 *
 * This is the single seam a caller (UI, cron, CLI) uses. It wires the pure
 * {@link createReviewFlag} contract to real backend dependencies (auth,
 * datastore, id/time providers) without leaking those concerns into the
 * contract itself. It intentionally contains no presentation logic.
 */

import {
  createReviewFlag,
  isReviewFlagError,
  type ReviewFlagInput,
  type ReviewFlagOutcome,
} from "../contract";

export interface ReviewFlagBackend {
  isAuthorizedReviewer(reviewer: string): Promise<boolean>;
  resourceExists(targetResource: string): Promise<boolean>;
  findOpenFlag(targetResource: string): Promise<string | null>;
  saveFlag(input: ReviewFlagInput, flagId: string): Promise<void>;
  now(): number;
  newId(): string;
}

export interface ReviewFlagService {
  raiseFlag(input: ReviewFlagInput): Promise<ReviewFlagOutcome>;
}

export function createReviewFlagService(backend: ReviewFlagBackend): ReviewFlagService {
  return {
    async raiseFlag(input: ReviewFlagInput): Promise<ReviewFlagOutcome> {
      const outcome = await createReviewFlag(input, {
        resolveReviewer: (reviewer) => backend.isAuthorizedReviewer(reviewer),
        resourceExists: (resource) => backend.resourceExists(resource),
        findExistingFlag: (resource) => backend.findOpenFlag(resource),
        persistFlag: (flagInput, result) => backend.saveFlag(flagInput, result.flagId),
        now: () => backend.now(),
        generateId: () => backend.newId(),
      });
      return outcome;
    },
  };
}

export { isReviewFlagError };
