/**
 * Feedback service for beta tester defect reports (Issue #2001 — BETA-094).
 *
 * Security guarantees:
 * - Message body, tokens, private keys, seed phrases, and raw address books
 *   are never collected. A regex scrubber runs over the free-text `steps`
 *   field before any data is persisted.
 * - Screenshots are stripped when `screenshotConsent` is false.
 * - Rate limiting: 5 submissions per account per hour (tracked via counter).
 * - reportId and reporterId are server-generated opaque tokens — never
 *   derived from or encoding account addresses.
 */

import type { ApiRepository } from "./repository";
import type {
  FeedbackCategory,
  FeedbackReport,
  FeedbackStatus,
  FeedbackSubmitInput,
} from "./domain";
import { ApiError } from "./errors";

// ---------------------------------------------------------------------------
// Spam / abuse controls
// ---------------------------------------------------------------------------

export const FEEDBACK_RATE_LIMIT = {
  max: 5,
  windowSeconds: 3600,
} as const;

export async function checkFeedbackRateLimit(
  repository: ApiRepository,
  reporterId: string,
): Promise<void> {
  const count = await repository.incrementCounter(
    `feedback:rate:${reporterId}`,
    FEEDBACK_RATE_LIMIT.windowSeconds,
  );
  if (count > FEEDBACK_RATE_LIMIT.max) {
    throw new ApiError(
      429,
      "too_many_requests",
      `Feedback submission limit reached. Please wait before submitting another report.`,
      { retryAfterSeconds: FEEDBACK_RATE_LIMIT.windowSeconds },
    );
  }
}

// ---------------------------------------------------------------------------
// Redaction — strips credential-like patterns from free text
// ---------------------------------------------------------------------------

/**
 * Patterns that indicate secret material. Any match is replaced with the
 * literal string "[REDACTED]" before the text is persisted.
 *
 * The list is intentionally conservative — false positives produce "[REDACTED]"
 * in steps text, which is harmless; false negatives could leak secrets.
 */
const SECRET_PATTERNS: RegExp[] = [
  // Stellar private key (S-address, 56 chars Base32)
  /\bS[A-Z2-7]{55}\b/g,
  // BIP-39 mnemonic (12/18/24 word sequence)
  /\b(?:[a-z]+ ){11,23}[a-z]+\b/g,
  // Generic JWT (three Base64url segments)
  /\bey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  // Hex strings ≥ 40 chars that could be keys/hashes
  /\b[0-9a-fA-F]{40,}\b/g,
  // Base64 strings ≥ 40 chars that could be encoded secrets
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Screenshot validation
// ---------------------------------------------------------------------------

const SCREENSHOT_MAX_BYTES = 512_000; // 512 KB

export function sanitizeScreenshot(
  screenshotConsent: boolean,
  screenshotDataUrl: string | null | undefined,
): string | null {
  if (!screenshotConsent) return null;
  if (!screenshotDataUrl) return null;
  if (!screenshotDataUrl.startsWith("data:image/")) return null;
  if (screenshotDataUrl.length > SCREENSHOT_MAX_BYTES) return null;
  return screenshotDataUrl;
}

// ---------------------------------------------------------------------------
// Diagnostics sanitization
// ---------------------------------------------------------------------------

/**
 * Strip any diagnostics fields that could carry secrets. The allow-list
 * approach ensures new fields must be explicitly cleared before they are
 * surfaced to the operations console.
 */
export function sanitizeDiagnostics(
  input: FeedbackSubmitInput["diagnostics"],
): FeedbackReport["diagnostics"] {
  if (!input) return null;

  return {
    appVersion: input.appVersion?.slice(0, 40),
    userAgent: input.userAgent?.slice(0, 300),
    // Route: strip query string and hash — only pathname is safe
    route: input.route ? input.route.split("?")[0].split("#")[0].slice(0, 200) : undefined,
    featureFlags: input.featureFlags,
    supportId: input.supportId?.slice(0, 128),
    serviceStatus: input.serviceStatus,
  };
}

// ---------------------------------------------------------------------------
// Core service operations
// ---------------------------------------------------------------------------

export async function submitFeedbackReport(
  repository: ApiRepository,
  input: FeedbackSubmitInput,
  reporterId: string,
): Promise<FeedbackReport> {
  await checkFeedbackRateLimit(repository, reporterId);

  const now = new Date().toISOString();
  const reportId = `fbk_${crypto.randomUUID().replace(/-/g, "")}`;

  const report: FeedbackReport = {
    reportId,
    category: input.category,
    severity: input.severity,
    status: "open",
    steps: redactSecrets(input.steps),
    screenshotConsent: input.screenshotConsent,
    screenshotDataUrl: sanitizeScreenshot(input.screenshotConsent, input.screenshotDataUrl),
    diagnostics: sanitizeDiagnostics(input.diagnostics),
    reporterId,
    createdAt: now,
    updatedAt: now,
    triageNotes: null,
    resolvedBy: null,
    resolvedAt: null,
  };

  return repository.createFeedbackReport(report);
}

export async function triageFeedbackReport(
  repository: ApiRepository,
  reportId: string,
  triageNotes: string,
  adminActor: string,
): Promise<FeedbackReport> {
  const existing = await repository.getFeedbackReport(reportId);
  if (!existing) {
    throw new ApiError(404, "not_found", `Feedback report ${reportId} not found`);
  }

  const now = new Date().toISOString();
  return repository.updateFeedbackReport({
    ...existing,
    status: "triaged",
    triageNotes: triageNotes.slice(0, 1000),
    updatedAt: now,
  });
}

export async function closeFeedbackReport(
  repository: ApiRepository,
  reportId: string,
  status: Extract<FeedbackStatus, "resolved" | "closed" | "wont_fix">,
  adminActor: string,
): Promise<FeedbackReport> {
  const existing = await repository.getFeedbackReport(reportId);
  if (!existing) {
    throw new ApiError(404, "not_found", `Feedback report ${reportId} not found`);
  }

  const now = new Date().toISOString();
  return repository.updateFeedbackReport({
    ...existing,
    status,
    resolvedBy: adminActor,
    resolvedAt: now,
    updatedAt: now,
  });
}

export async function exportFeedbackReports(
  repository: ApiRepository,
  filter?: { status?: FeedbackStatus; category?: FeedbackCategory; limit?: number },
): Promise<FeedbackReport[]> {
  return repository.listFeedbackReports(filter);
}

/**
 * Build the preview payload shown to the user before submission.
 * This is exactly what will be stored — the same redaction pipeline runs here.
 */
export function buildSubmissionPreview(
  input: FeedbackSubmitInput,
  reporterId: string,
): Omit<
  FeedbackReport,
  "reportId" | "createdAt" | "updatedAt" | "status" | "resolvedBy" | "resolvedAt"
> {
  return {
    category: input.category,
    severity: input.severity,
    steps: redactSecrets(input.steps),
    screenshotConsent: input.screenshotConsent,
    screenshotDataUrl: sanitizeScreenshot(input.screenshotConsent, input.screenshotDataUrl),
    diagnostics: sanitizeDiagnostics(input.diagnostics),
    reporterId,
    triageNotes: null,
  };
}
