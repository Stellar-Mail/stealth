/**
 * Deterministic fixtures for the Legal & Compliance Review Flag contract.
 *
 * These are shared between unit tests and manual integrations so the "given"
 * state is identical everywhere. No randomness: every value is fixed so a
 * failing assertion is reproducible.
 */

import type { ReviewFlagInput, ReviewFlagDependency } from "./contract";

export const authorizedReviewer = "reviewer:legal-001";
export const unauthorizedReviewer = "reviewer:intern-007";

export const existingResource = "mail:thread:existing-abc";
export const missingResource = "mail:thread:missing-xyz";

export const validInput: ReviewFlagInput = {
  reviewer: authorizedReviewer,
  targetResource: existingResource,
  flagReason: "Sender domain fails DKIM; possible spoofing of a regulated entity.",
  severity: "high",
  evidenceRefs: ["scan:vt-8821", "ticket:sec-334"],
};

export const lowSeverityInput: ReviewFlagInput = {
  reviewer: authorizedReviewer,
  targetResource: existingResource,
  flagReason: "Recipient requested review of a promotional blast.",
  severity: "low",
};

export const missingReviewerInput: ReviewFlagInput = {
  reviewer: "",
  targetResource: existingResource,
  flagReason: "No reviewer supplied.",
  severity: "medium",
};

export const missingReasonInput: ReviewFlagInput = {
  reviewer: authorizedReviewer,
  targetResource: existingResource,
  flagReason: "",
  severity: "medium",
};

export const invalidSeverityInput: ReviewFlagInput = {
  reviewer: authorizedReviewer,
  targetResource: existingResource,
  flagReason: "Bad severity value.",
  severity: "urgent" as ReviewFlagInput["severity"],
};

export const resourceNotFoundInput: ReviewFlagInput = {
  reviewer: authorizedReviewer,
  targetResource: missingResource,
  flagReason: "Flag on a resource that was purged.",
  severity: "high",
};

export const oversizedInput: ReviewFlagInput = {
  reviewer: authorizedReviewer,
  targetResource: existingResource,
  flagReason: "A".repeat(2500), // > 2000
  severity: "high",
  evidenceRefs: Array(15).fill("ticket:sec-334"), // > 10 items
};

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `flag:fixed-${idCounter}`;
}

/**
 * Builds a {@link ReviewFlagDependency} with a configurable backend. Flags are
 * never actually written anywhere (the in-memory map is the "persistence"
 * surface under test), so the contract stays side-effect-isolated.
 */
export function makeDependency(
  overrides: {
    authorized?: boolean;
    resourceExists?: boolean;
    existingFlagId?: string | null;
  } = {},
): ReviewFlagDependency & { persisted: ReviewFlagInput[] } {
  const authorized = overrides.authorized ?? true;
  const resourceExists = overrides.resourceExists ?? true;
  const existingFlagId = overrides.existingFlagId ?? null;
  const persisted: ReviewFlagInput[] = [];

  return {
    resolveReviewer: (reviewer: string) => authorized && reviewer === authorizedReviewer,
    resourceExists: (resource: string) => resourceExists && resource === existingResource,
    findExistingFlag: (resource: string) =>
      existingFlagId !== null && resource === existingResource ? existingFlagId : null,
    persistFlag: (input) => {
      persisted.push(input);
    },
    now: () => 1_700_000_000_000,
    generateId: nextId,
    persisted,
  };
}
