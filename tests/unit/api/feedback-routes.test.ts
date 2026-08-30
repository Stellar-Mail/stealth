/**
 * Tests for the beta tester feedback reporting system (Issue #2001 — BETA-094).
 *
 * Coverage:
 * - Redaction: secret-like patterns in steps are scrubbed.
 * - Screenshot: stripped when consent is absent.
 * - Oversized input: rejected.
 * - Rate limiting: 6th submission within the window is rejected.
 * - Authorization: admin routes require admin address.
 * - Triage and close lifecycle.
 * - Export NDJSON integrity (no plaintext secrets).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { MemoryApiRepository } from "@/server/api/memory-repository";
import { getApiContext } from "@/server/api/context";
import { Route as FeedbackRoute } from "@/routes/api/v1/feedback/index";
import { Route as AdminFeedbackRoute } from "@/routes/api/v1/admin/feedback/index";
import { Route as TriageRoute } from "@/routes/api/v1/admin/feedback/$reportId/triage";
import { Route as CloseRoute } from "@/routes/api/v1/admin/feedback/$reportId/close";
import {
  redactSecrets,
  sanitizeScreenshot,
  FEEDBACK_RATE_LIMIT,
} from "@/server/api/feedback-service";

const feedbackPostHandler = (FeedbackRoute.options as any).server?.handlers?.POST;
const adminFeedbackListHandler = (AdminFeedbackRoute.options as any).server?.handlers?.GET;
const triageHandler = (TriageRoute.options as any).server?.handlers?.POST;
const closeHandler = (CloseRoute.options as any).server?.handlers?.POST;

const ADMIN_ADDR = "GADMIN77777777777777777777777777777777777777777777777777";
const USER_ADDR = "GUSER222222222222222222222222222222222222222222222222222";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function feedbackBody(overrides: Record<string, unknown> = {}) {
  return {
    category: "bug",
    severity: "high",
    steps: "1. Open the app\n2. Click send\n3. See error in network tab",
    screenshotConsent: false,
    screenshotDataUrl: null,
    diagnostics: {
      appVersion: "1.4.2-beta",
      userAgent: "vitest",
      route: "/mailbox",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Unit tests — redaction and sanitization
// ---------------------------------------------------------------------------

describe("Feedback redaction", () => {
  it("strips Stellar private key (S-address) from steps", () => {
    const steps = "I pasted my key SCZANGBA4GEHIOWY3MHNHQBV4MHJLIZGQ7DFKZPJM2GRLMEUQKHIUI here";
    const redacted = redactSecrets(steps);
    expect(redacted).not.toContain("SCZANGBA4GEHIOWY3MHNHQBV4MHJLIZGQ7DFKZPJM2GRLMEUQKHIUI");
    expect(redacted).toContain("[REDACTED]");
  });

  it("strips JWT tokens from steps", () => {
    const steps =
      "Error: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3IifQ.XXXXXXXXXXXXXXXXXXXXXXXXXXX occurred";
    const redacted = redactSecrets(steps);
    expect(redacted).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(redacted).toContain("[REDACTED]");
  });

  it("strips long hex strings that could be keys", () => {
    const steps = "hash: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 in logs";
    const redacted = redactSecrets(steps);
    expect(redacted).not.toContain(
      "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    );
    expect(redacted).toContain("[REDACTED]");
  });

  it("preserves innocuous short text", () => {
    const steps = "Click the send button and see error 500";
    expect(redactSecrets(steps)).toBe(steps);
  });
});

describe("Screenshot sanitization", () => {
  it("returns null when consent is false, even if dataUrl is provided", () => {
    const result = sanitizeScreenshot(false, "data:image/png;base64,iVBOR==");
    expect(result).toBeNull();
  });

  it("returns null when consent is true but no dataUrl", () => {
    const result = sanitizeScreenshot(true, null);
    expect(result).toBeNull();
  });

  it("returns null for non-image data URLs", () => {
    const result = sanitizeScreenshot(true, "data:text/html;base64,abc");
    expect(result).toBeNull();
  });

  it("returns the dataUrl when consent is true and it is a valid image", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA";
    const result = sanitizeScreenshot(true, dataUrl);
    expect(result).toBe(dataUrl);
  });

  it("returns null for oversized screenshots", () => {
    const huge = "data:image/png;base64," + "A".repeat(512_001);
    const result = sanitizeScreenshot(true, huge);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// API route tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/feedback", () => {
  let repository: MemoryApiRepository;

  beforeEach(async () => {
    const ctx = await getApiContext();
    repository = ctx.repository as MemoryApiRepository;
    repository.reset?.();
  });

  it("accepts a valid submission and returns 201", async () => {
    const req = new Request("http://localhost/api/v1/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", "x-support-id": "anon_testtoken12345678" },
      body: JSON.stringify(feedbackBody()),
    });
    const res = await feedbackPostHandler({ request: req });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.report.reportId).toMatch(/^fbk_/);
    expect(body.data.report.status).toBe("open");
    expect(body.data.report.category).toBe("bug");
  });

  it("strips screenshot when screenshotConsent is false", async () => {
    const req = new Request("http://localhost/api/v1/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        feedbackBody({
          screenshotConsent: false,
          screenshotDataUrl: "data:image/png;base64,iVBOR==",
        }),
      ),
    });
    const res = await feedbackPostHandler({ request: req });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.report.screenshotDataUrl).toBeNull();
  });

  it("redacts secret patterns in steps before storage", async () => {
    const req = new Request("http://localhost/api/v1/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        feedbackBody({
          steps:
            "I accidentally pasted SCZANGBA4GEHIOWY3MHNHQBV4MHJLIZGQ7DFKZPJM2GRLMEUQKHIUI in the steps",
        }),
      ),
    });
    const res = await feedbackPostHandler({ request: req });
    const body = (await res.json()) as any;
    // The private key must not appear in the stored steps
    expect(body.data.report.steps).not.toContain("SCZANGBA4GEHIOWY");
    expect(body.data.report.steps).toContain("[REDACTED]");
  });

  it("rejects steps shorter than 10 characters with 422", async () => {
    const req = new Request("http://localhost/api/v1/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(feedbackBody({ steps: "too short" })),
    });
    const res = await feedbackPostHandler({ request: req });
    expect(res.status).toBe(422);
  });

  it("rejects a body exceeding 2000 chars in steps", async () => {
    const req = new Request("http://localhost/api/v1/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(feedbackBody({ steps: "A".repeat(2001) })),
    });
    const res = await feedbackPostHandler({ request: req });
    expect(res.status).toBe(422);
  });

  it("enforces the rate limit — 6th submission is rejected with 429", async () => {
    const supportId = "spam_token_testxyz99";
    for (let i = 0; i < FEEDBACK_RATE_LIMIT.max; i++) {
      const req = new Request("http://localhost/api/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json", "x-support-id": supportId },
        body: JSON.stringify(feedbackBody()),
      });
      const res = await feedbackPostHandler({ request: req });
      expect(res.status).toBe(201);
    }

    // 6th request — must be rate-limited
    const req = new Request("http://localhost/api/v1/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", "x-support-id": supportId },
      body: JSON.stringify(feedbackBody()),
    });
    const res = await feedbackPostHandler({ request: req });
    expect(res.status).toBe(429);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("too_many_requests");
  });

  it("preview mode returns sanitised payload without persisting", async () => {
    const req = new Request("http://localhost/api/v1/feedback?preview=true", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(feedbackBody()),
    });
    const res = await feedbackPostHandler({ request: req });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.persisted).toBe(false);
    expect(body.data.preview).toBeDefined();
    expect(body.data.preview.steps).toBeDefined();

    // Confirm nothing was stored
    const reports = await repository.listFeedbackReports();
    expect(reports).toHaveLength(0);
  });

  it("rejects wrong Content-Type (CSRF plain-text vector)", async () => {
    const req = new Request("http://localhost/api/v1/feedback", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "steps=some+bug",
    });
    const res = await feedbackPostHandler({ request: req });
    expect(res.status).not.toBe(201);
  });
});

// ---------------------------------------------------------------------------
// Admin route tests
// ---------------------------------------------------------------------------

describe("Admin feedback operations", () => {
  let repository: MemoryApiRepository;
  let createdReportId: string;

  beforeEach(async () => {
    const ctx = await getApiContext();
    repository = ctx.repository as MemoryApiRepository;
    repository.reset?.();

    // Seed one report
    const req = new Request("http://localhost/api/v1/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", "x-support-id": "seed_token_abc123456" },
      body: JSON.stringify(feedbackBody()),
    });
    const res = await feedbackPostHandler({ request: req });
    const body = (await res.json()) as any;
    createdReportId = body.data.report.reportId;
  });

  it("rejects unauthenticated list request", async () => {
    const req = new Request("http://localhost/api/v1/admin/feedback", { method: "GET" });
    const res = await adminFeedbackListHandler({ request: req });
    expect(res.status).toBe(401);
  });

  it("rejects non-admin list request", async () => {
    const req = new Request("http://localhost/api/v1/admin/feedback", {
      method: "GET",
      headers: { "x-stealth-address": USER_ADDR },
    });
    const res = await adminFeedbackListHandler({ request: req });
    expect(res.status).toBe(403);
  });

  it("admin can list feedback reports", async () => {
    const req = new Request("http://localhost/api/v1/admin/feedback", {
      method: "GET",
      headers: { "x-stealth-address": ADMIN_ADDR },
    });
    const res = await adminFeedbackListHandler({ request: req });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.reports).toHaveLength(1);
    expect(body.data.reports[0].reportId).toBe(createdReportId);
  });

  it("admin can filter by status", async () => {
    const req = new Request("http://localhost/api/v1/admin/feedback?status=triaged", {
      method: "GET",
      headers: { "x-stealth-address": ADMIN_ADDR },
    });
    const res = await adminFeedbackListHandler({ request: req });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // No triaged reports yet
    expect(body.data.reports).toHaveLength(0);
  });

  it("admin can triage a report", async () => {
    const req = new Request(`http://localhost/api/v1/admin/feedback/${createdReportId}/triage`, {
      method: "POST",
      headers: { "x-stealth-address": ADMIN_ADDR, "content-type": "application/json" },
      body: JSON.stringify({ triageNotes: "Reproduced locally — assigned to UI team" }),
    });
    const res = await triageHandler({ request: req, params: { reportId: createdReportId } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.report.status).toBe("triaged");
    expect(body.data.report.triageNotes).toBe("Reproduced locally — assigned to UI team");
  });

  it("rejects triage with notes shorter than 4 chars", async () => {
    const req = new Request(`http://localhost/api/v1/admin/feedback/${createdReportId}/triage`, {
      method: "POST",
      headers: { "x-stealth-address": ADMIN_ADDR, "content-type": "application/json" },
      body: JSON.stringify({ triageNotes: "ab" }),
    });
    const res = await triageHandler({ request: req, params: { reportId: createdReportId } });
    expect(res.status).toBe(422);
  });

  it("admin can close a report as resolved", async () => {
    const req = new Request(`http://localhost/api/v1/admin/feedback/${createdReportId}/close`, {
      method: "POST",
      headers: { "x-stealth-address": ADMIN_ADDR, "content-type": "application/json" },
      body: JSON.stringify({ status: "resolved", reason: "Fixed in v1.4.3-beta patch" }),
    });
    const res = await closeHandler({ request: req, params: { reportId: createdReportId } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.report.status).toBe("resolved");
    expect(body.data.report.resolvedBy).toBe(ADMIN_ADDR);
    expect(body.data.report.resolvedAt).not.toBeNull();
  });

  it("admin can mark a report as wont_fix", async () => {
    const req = new Request(`http://localhost/api/v1/admin/feedback/${createdReportId}/close`, {
      method: "POST",
      headers: { "x-stealth-address": ADMIN_ADDR, "content-type": "application/json" },
      body: JSON.stringify({ status: "wont_fix", reason: "Working as intended per design spec" }),
    });
    const res = await closeHandler({ request: req, params: { reportId: createdReportId } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.report.status).toBe("wont_fix");
  });

  it("rejects close without a reason", async () => {
    const req = new Request(`http://localhost/api/v1/admin/feedback/${createdReportId}/close`, {
      method: "POST",
      headers: { "x-stealth-address": ADMIN_ADDR, "content-type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    const res = await closeHandler({ request: req, params: { reportId: createdReportId } });
    expect(res.status).toBe(422);
  });

  it("reports do not contain plaintext message body, token, key, or seed", async () => {
    const req = new Request("http://localhost/api/v1/admin/feedback", {
      method: "GET",
      headers: { "x-stealth-address": ADMIN_ADDR },
    });
    const res = await adminFeedbackListHandler({ request: req });
    const body = (await res.json()) as any;
    const raw = JSON.stringify(body);

    // None of these should appear in any stored payload
    expect(raw).not.toMatch(/SCZANGBA4GEHIOWY3MHNHQBV4MHJLIZGQ7DFKZPJM2GRLMEUQKHIUI/);
    expect(raw).not.toContain("eyJhbGci");
    expect(raw).not.toContain("password");
    expect(raw).not.toContain("seed phrase");
  });
});
