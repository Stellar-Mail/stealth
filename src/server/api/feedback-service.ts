import { createHash } from "node:crypto";
import { z } from "zod";

import {
  feedbackCategorySchema,
  feedbackDiagnosticsSchema,
  feedbackSeveritySchema,
  feedbackStatusSchema,
  feedbackReportSchema,
  type FeedbackCategory,
  type FeedbackDiagnostics,
  type FeedbackReport,
  type FeedbackScreenshot,
  type FeedbackSeverity,
  type FeedbackStatus,
} from "./domain";
import { ApiError } from "./errors";
import type { ApiRepository } from "./repository";
import { recordAuditEvent } from "./audit";
import type { ApiContext } from "./context";
import { parseSessionCookie, validateSession } from "./auth/session-service";
import { recordAdminMutationAudit } from "./authorization/admin";

export const FEEDBACK_SCREENSHOT_MAX_BYTES = 1024 * 1024;
export const FEEDBACK_RATE_LIMITS = Object.freeze({
  account: { max: 5, windowSeconds: 60 * 60 },
  ip: { max: 20, windowSeconds: 60 * 60 },
});

const screenshotSubmissionSchema = z
  .object({
    dataUrl: z.string().min(32).max(1_500_100),
  })
  .strict();

export const feedbackSubmissionSchema = z
  .object({
    category: feedbackCategorySchema,
    severity: feedbackSeveritySchema,
    steps: z.string().trim().min(10).max(4000),
    diagnosticsConsent: z.boolean(),
    diagnostics: feedbackDiagnosticsSchema.nullable(),
    screenshotConsent: z.boolean(),
    screenshot: screenshotSubmissionSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.diagnosticsConsent !== (value.diagnostics !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diagnostics"],
        message: "Diagnostics must be present only when diagnostics consent is granted",
      });
    }
    if (value.screenshotConsent !== (value.screenshot !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["screenshot"],
        message: "A screenshot must be present only when screenshot consent is granted",
      });
    }
  });

export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>;

/** Resolve a beta tester from signed/header auth or the normal browser session. */
export async function requireFeedbackActor(context: ApiContext, request: Request): Promise<string> {
  if (context.principal) return context.principal.address;
  const sessionId = parseSessionCookie(request.headers.get("cookie"));
  if (sessionId) {
    const active = await validateSession(context, sessionId);
    if (active) return active.user.address;
  }
  throw new ApiError(401, "unauthorized", "Authentication required to submit feedback");
}

const SENSITIVE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/gi,
    "[redacted-private-key]",
  ],
  [/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted-token]"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-token]"],
  [
    /\b(?:password|passwd|token|secret|seed|private[ _-]?key|api[ _-]?key|authorization)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
    "[redacted-secret]",
  ],
  [/\bS[A-Z2-7]{55}\b/g, "[redacted-seed]"],
  [/\bG[A-Z2-7]{55}\b/g, "[redacted-address]"],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-address]"],
  [/\b[0-9a-f]{64,}\b/gi, "[redacted-value]"],
];

/** Redacts high-confidence secret/address patterns from explicit user prose. */
export function redactSensitiveText(value: string): string {
  let redacted = Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join("");
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted.trim();
}

export function sanitizeFeedbackRoute(value: string): string {
  let pathname = value;
  try {
    pathname = new URL(value, "https://feedback.invalid").pathname;
  } catch {
    pathname = value.split(/[?#]/, 1)[0] ?? "/";
  }

  const safeSegments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        // Keep the encoded segment; invalid encoding is treated as opaque.
      }
      if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(decoded)) return ":id";
      if (/^[GS][A-Z2-7]{55}$/.test(decoded)) return ":address";
      if (/^[0-9a-f]{24,}$/i.test(decoded) || decoded.length > 40) return ":id";
      return decoded.replace(/[^A-Za-z0-9._~-]/g, "-").slice(0, 40) || ":segment";
    });

  return `/${safeSegments.join("/")}`.slice(0, 160) || "/";
}

function sanitizeMetadataText(value: string, maxLength: number, fallback: string): string {
  const result = redactSensitiveText(value).replace(/\s+/g, " ").slice(0, maxLength).trim();
  return result || fallback;
}

export function sanitizeFeedbackDiagnostics(diagnostics: FeedbackDiagnostics): FeedbackDiagnostics {
  const featureFlags = Array.from(
    new Set(
      diagnostics.featureFlags
        .filter((flag) => /^[A-Za-z0-9._-]{1,64}$/.test(flag))
        .filter((flag) => !/(?:secret|token|password|seed|private|credential|address)/i.test(flag)),
    ),
  ).slice(0, 32);

  return {
    appVersion: sanitizeMetadataText(diagnostics.appVersion, 80, "unknown"),
    browser: sanitizeMetadataText(diagnostics.browser, 120, "unknown"),
    route: sanitizeFeedbackRoute(diagnostics.route),
    featureFlags,
    supportId: diagnostics.supportId,
    serviceStatus: diagnostics.serviceStatus,
  };
}

function decodeBase64(base64: string): Uint8Array {
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new ApiError(400, "bad_request", "Screenshot is not valid base64");
  }
  try {
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new ApiError(400, "bad_request", "Screenshot is not valid base64");
  }
}

function hasExpectedMagicBytes(mediaType: FeedbackScreenshot["mediaType"], bytes: Uint8Array) {
  if (mediaType === "image/png") {
    return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  }
  if (mediaType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

export function validateFeedbackScreenshot(dataUrl: string): FeedbackScreenshot {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    throw new ApiError(400, "bad_request", "Screenshot must be PNG, JPEG, or WebP");
  }
  const mediaType = match[1] as FeedbackScreenshot["mediaType"];
  const base64 = match[2];
  const bytes = decodeBase64(base64);
  if (bytes.byteLength === 0 || bytes.byteLength > FEEDBACK_SCREENSHOT_MAX_BYTES) {
    throw new ApiError(
      413,
      "bad_request",
      `Screenshot exceeds ${FEEDBACK_SCREENSHOT_MAX_BYTES} bytes`,
    );
  }
  if (!hasExpectedMagicBytes(mediaType, bytes)) {
    throw new ApiError(400, "bad_request", "Screenshot content does not match its media type");
  }
  return { mediaType, sizeBytes: bytes.byteLength, base64 };
}

export function feedbackActorReference(prefix: "usr" | "op", value: string): string {
  const digest = createHash("sha256").update(value.trim().toUpperCase()).digest("hex").slice(0, 16);
  return `${prefix}_${digest}`;
}

function rateLimitSubject(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export async function enforceFeedbackRateLimit(
  repository: ApiRepository,
  actor: string,
  request: Request,
): Promise<void> {
  const accountCount = await repository.incrementCounter(
    `feedback:account:${rateLimitSubject(actor.toUpperCase())}`,
    FEEDBACK_RATE_LIMITS.account.windowSeconds,
  );
  if (accountCount > FEEDBACK_RATE_LIMITS.account.max) {
    throw new ApiError("too_many_requests", {
      retryAfterSeconds: FEEDBACK_RATE_LIMITS.account.windowSeconds,
    });
  }

  const ip =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    "unknown";
  if (ip !== "unknown") {
    const ipCount = await repository.incrementCounter(
      `feedback:ip:${rateLimitSubject(ip)}`,
      FEEDBACK_RATE_LIMITS.ip.windowSeconds,
    );
    if (ipCount > FEEDBACK_RATE_LIMITS.ip.max) {
      throw new ApiError("too_many_requests", {
        retryAfterSeconds: FEEDBACK_RATE_LIMITS.ip.windowSeconds,
      });
    }
  }
}

export async function createFeedbackReport(params: {
  repository: ApiRepository;
  actor: string;
  request: Request;
  submission: FeedbackSubmission;
  now?: Date;
}): Promise<FeedbackReport> {
  await enforceFeedbackRateLimit(params.repository, params.actor, params.request);

  const steps = redactSensitiveText(params.submission.steps);
  if (steps.length < 10 || new Set(steps.replace(/\s/g, "")).size < 3) {
    throw new ApiError(400, "bad_request", "Reproduction steps are too repetitive or empty");
  }

  const now = params.now ?? new Date();
  const iso = now.toISOString();
  const report: FeedbackReport = {
    reportId: `fb_${crypto.randomUUID()}`,
    reporterReference: feedbackActorReference("usr", params.actor),
    category: params.submission.category,
    severity: params.submission.severity,
    steps,
    diagnosticsConsent: params.submission.diagnosticsConsent,
    diagnostics: params.submission.diagnostics
      ? sanitizeFeedbackDiagnostics(params.submission.diagnostics)
      : null,
    screenshotConsent: params.submission.screenshotConsent,
    screenshot: params.submission.screenshot
      ? validateFeedbackScreenshot(params.submission.screenshot.dataUrl)
      : null,
    status: "new",
    triageNote: null,
    createdAt: iso,
    updatedAt: iso,
    closedAt: null,
    closedByReference: null,
    version: 1,
  };

  const stored = await params.repository.setFeedbackReport(report);
  recordAuditEvent({
    actor: stored.reporterReference,
    action: "feedback.create",
    targetType: "feedback_report",
    safeTargetReference: stored.reportId,
    result: "success",
    requestId: params.request.headers.get("x-request-id")?.trim() || "",
  });
  return stored;
}

export type FeedbackOperatorView = Omit<FeedbackReport, "screenshot" | "$v"> & {
  screenshot: null | Pick<FeedbackScreenshot, "mediaType" | "sizeBytes">;
};

export function validateStoredFeedbackReport(value: unknown, requestId = ""): FeedbackReport {
  const parsed = feedbackReportSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError("data_integrity_error", {
      recordType: "feedbackReport",
      correlationId: requestId,
    });
  }
  return parsed.data;
}

export function toFeedbackOperatorView(report: FeedbackReport): FeedbackOperatorView {
  const safe = validateStoredFeedbackReport(report);
  return {
    reportId: safe.reportId,
    reporterReference: safe.reporterReference,
    category: safe.category,
    severity: safe.severity,
    steps: safe.steps,
    diagnosticsConsent: safe.diagnosticsConsent,
    diagnostics: safe.diagnostics,
    screenshotConsent: safe.screenshotConsent,
    screenshot: safe.screenshot
      ? { mediaType: safe.screenshot.mediaType, sizeBytes: safe.screenshot.sizeBytes }
      : null,
    status: safe.status,
    triageNote: safe.triageNote,
    createdAt: safe.createdAt,
    updatedAt: safe.updatedAt,
    closedAt: safe.closedAt,
    closedByReference: safe.closedByReference,
    version: safe.version,
  };
}

export async function listFeedbackForOperators(
  repository: ApiRepository,
  filter?: {
    status?: FeedbackStatus;
    category?: FeedbackCategory;
    severity?: FeedbackSeverity;
    limit?: number;
  },
): Promise<FeedbackOperatorView[]> {
  return (await repository.listFeedbackReports(filter)).map(toFeedbackOperatorView);
}

export async function updateFeedbackWorkflow(params: {
  repository: ApiRepository;
  reportId: string;
  expectedVersion: number;
  status: FeedbackStatus;
  triageNote?: string | null;
  operator: string;
  reason: string;
  requestId: string;
  now?: Date;
}): Promise<FeedbackReport> {
  const storedCurrent = await params.repository.getFeedbackReport(params.reportId);
  if (!storedCurrent) throw new ApiError(404, "not_found", "Feedback report not found");
  const current = validateStoredFeedbackReport(storedCurrent, params.requestId);
  if (current.version !== params.expectedVersion) {
    throw new ApiError(409, "conflict", "Feedback report changed; refresh before retrying");
  }

  const now = params.now ?? new Date();
  const closing = params.status === "closed";
  const updated: FeedbackReport = {
    ...current,
    status: params.status,
    triageNote:
      params.triageNote === undefined
        ? current.triageNote
        : params.triageNote
          ? redactSensitiveText(params.triageNote).slice(0, 1000)
          : null,
    updatedAt: now.toISOString(),
    closedAt: closing ? now.toISOString() : null,
    closedByReference: closing ? feedbackActorReference("op", params.operator) : null,
    version: current.version + 1,
  };

  const stored = await params.repository.setFeedbackReport(updated);
  recordAdminMutationAudit({
    actor: feedbackActorReference("op", params.operator),
    action: `feedback.${params.status}`,
    target: params.reportId,
    reason: redactSensitiveText(params.reason).slice(0, 500),
    beforeState: feedbackAuditState(current),
    afterState: feedbackAuditState(stored),
    result: "success",
    requestId: params.requestId,
  });
  return stored;
}

export async function removeFeedbackScreenshot(params: {
  repository: ApiRepository;
  reportId: string;
  expectedVersion: number;
  operator: string;
  reason: string;
  requestId: string;
  now?: Date;
}): Promise<FeedbackReport> {
  const storedCurrent = await params.repository.getFeedbackReport(params.reportId);
  if (!storedCurrent) throw new ApiError(404, "not_found", "Feedback report not found");
  const current = validateStoredFeedbackReport(storedCurrent, params.requestId);
  if (current.version !== params.expectedVersion) {
    throw new ApiError(409, "conflict", "Feedback report changed; refresh before retrying");
  }
  if (!current.screenshot) return current;

  const updated: FeedbackReport = {
    ...current,
    screenshot: null,
    updatedAt: (params.now ?? new Date()).toISOString(),
    version: current.version + 1,
  };
  const stored = await params.repository.setFeedbackReport(updated);
  recordAdminMutationAudit({
    actor: feedbackActorReference("op", params.operator),
    action: "feedback.screenshot.remove",
    target: params.reportId,
    reason: redactSensitiveText(params.reason).slice(0, 500),
    beforeState: feedbackAuditState(current),
    afterState: feedbackAuditState(stored),
    result: "success",
    requestId: params.requestId,
  });
  return stored;
}

function feedbackAuditState(report: FeedbackReport) {
  return {
    category: report.category,
    severity: report.severity,
    status: report.status,
    screenshotStored: report.screenshot !== null,
    version: report.version,
  };
}

function csvCell(value: unknown): string {
  const serialized = typeof value === "string" ? value : JSON.stringify(value ?? null);
  // Prevent spreadsheet applications from interpreting tester-controlled text
  // as a formula when an operator opens the CSV export.
  const text = /^[=+\-@\t\r]/.test(serialized) ? `'${serialized}` : serialized;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportFeedbackReports(reports: FeedbackReport[], format: "json" | "csv"): string {
  const safe = reports.map(toFeedbackOperatorView);
  if (format === "json") return JSON.stringify({ schemaVersion: 1, reports: safe }, null, 2);

  const headers = [
    "reportId",
    "reporterReference",
    "category",
    "severity",
    "status",
    "steps",
    "diagnostics",
    "screenshot",
    "triageNote",
    "createdAt",
    "updatedAt",
  ];
  const rows = safe.map((report) =>
    [
      report.reportId,
      report.reporterReference,
      report.category,
      report.severity,
      report.status,
      report.steps,
      report.diagnostics,
      report.screenshot,
      report.triageNote,
      report.createdAt,
      report.updatedAt,
    ]
      .map(csvCell)
      .join(","),
  );
  return [headers.map(csvCell).join(","), ...rows].join("\n");
}

export function feedbackWorkflowFilterSchema() {
  return z
    .object({
      status: feedbackStatusSchema.optional(),
      category: feedbackCategorySchema.optional(),
      severity: feedbackSeveritySchema.optional(),
      limit: z.coerce.number().int().min(1).max(200).default(100),
    })
    .strict();
}
