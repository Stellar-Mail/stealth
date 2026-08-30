import { redactFeedbackNote } from "./redact";
import type { BetaFeedbackPayload, BetaFeedbackSubmissionResult } from "./types";

export class BetaFeedbackValidationError extends Error {
  readonly code = "beta_feedback_validation_error" as const;
}

export function buildBetaFeedbackPayload(
  input: Partial<BetaFeedbackPayload> &
    Pick<BetaFeedbackPayload, "sessionId" | "taskId" | "category">,
): BetaFeedbackSubmissionResult {
  if (!input.informedConsent) {
    throw new BetaFeedbackValidationError("Informed diagnostic consent is required");
  }
  if (!input.rating || input.rating < 1 || input.rating > 5) {
    throw new BetaFeedbackValidationError("Rating must be between 1 and 5");
  }
  const viewport = input.viewport ?? "desktop";
  if (viewport !== "desktop" && viewport !== "mobile") {
    throw new BetaFeedbackValidationError("Viewport must be desktop or mobile");
  }

  const redacted: BetaFeedbackPayload = {
    sessionId: input.sessionId,
    taskId: input.taskId,
    category: input.category,
    rating: input.rating,
    note: input.note ? redactFeedbackNote(input.note) : undefined,
    informedConsent: true,
    viewport,
    submittedAt: input.submittedAt ?? new Date().toISOString(),
  };

  return { ok: true, redacted };
}
