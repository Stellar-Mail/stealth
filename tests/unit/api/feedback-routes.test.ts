import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as FeedbackRoute } from "@/routes/api/v1/feedback/index";
import { Route as AdminFeedbackRoute } from "@/routes/api/v1/admin/feedback/index";
import { Route as AdminFeedbackItemRoute } from "@/routes/api/v1/admin/feedback/$reportId";
import { Route as AdminFeedbackScreenshotRoute } from "@/routes/api/v1/admin/feedback/$reportId/screenshot";
import { Route as AdminFeedbackExportRoute } from "@/routes/api/v1/admin/feedback/export";
import { ACTOR_HEADER } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import {
  FEEDBACK_SCREENSHOT_MAX_BYTES,
  exportFeedbackReports,
  feedbackSubmissionSchema,
  redactSensitiveText,
  sanitizeFeedbackRoute,
} from "@/server/api/feedback-service";
import type { MemoryApiRepository } from "@/server/api/memory-repository";

const USER = `G${"A".repeat(55)}`;
const OTHER_USER = `G${"B".repeat(55)}`;
const ADMIN = "GADMIN77777777777777777777777777777777777777777777777777";
const PRIVATE_SEED = `S${"C".repeat(55)}`;
const PUBLIC_ADDRESS = `G${"D".repeat(55)}`;
const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgo=";

const createHandler = (FeedbackRoute.options as any).server.handlers.POST;
const listHandler = (AdminFeedbackRoute.options as any).server.handlers.GET;
const getHandler = (AdminFeedbackItemRoute.options as any).server.handlers.GET;
const patchHandler = (AdminFeedbackItemRoute.options as any).server.handlers.PATCH;
const screenshotGetHandler = (AdminFeedbackScreenshotRoute.options as any).server.handlers.GET;
const screenshotDeleteHandler = (AdminFeedbackScreenshotRoute.options as any).server.handlers
  .DELETE;
const exportHandler = (AdminFeedbackExportRoute.options as any).server.handlers.GET;

function submission(overrides: Record<string, unknown> = {}) {
  return {
    category: "bug",
    severity: "high",
    steps: "1. Open inbox 2. Select a message 3. Observe the error",
    diagnosticsConsent: false,
    diagnostics: null,
    screenshotConsent: false,
    screenshot: null,
    ...overrides,
  };
}

function jsonRequest(
  path: string,
  method: string,
  actor?: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...extraHeaders,
  };
  if (actor) headers[ACTOR_HEADER] = actor;
  return new Request(`https://stealth.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createReport(body = submission(), actor = USER) {
  const response = await createHandler({
    request: jsonRequest("/api/v1/feedback", "POST", actor, body, {
      "cf-connecting-ip": actor === USER ? "192.0.2.10" : "192.0.2.11",
      "x-request-id": "feedback-test-request",
    }),
  });
  return response;
}

async function responseBody(response: Response) {
  return (await response.json()) as any;
}

describe("BETA-096 privacy-safe beta feedback routes", () => {
  let repository: MemoryApiRepository;
  let auditSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    repository = (await getApiContext()).repository as MemoryApiRepository;
    repository.reset();
    auditSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    auditSpy.mockRestore();
  });

  it("requires authentication and rejects unexpected automatic data fields", async () => {
    const anonymous = await createHandler({
      request: jsonRequest("/api/v1/feedback", "POST", undefined, submission()),
    });
    expect(anonymous.status).toBe(401);

    for (const forbiddenField of [
      "messageBody",
      "token",
      "privateKey",
      "addressBook",
      "attachment",
    ]) {
      const response = await createReport(submission({ [forbiddenField]: "must-not-enter" }));
      expect(response.status, forbiddenField).toBe(422);
      expect(await responseBody(response)).toMatchObject({
        error: {
          code: "validation_error",
          details: {
            validationErrors: expect.arrayContaining([
              expect.objectContaining({ rule: "unknown_field" }),
            ]),
          },
        },
      });
    }
    expect(await repository.listFeedbackReports()).toHaveLength(0);
  });

  it("supports normal same-origin session cookies for testers and browser operators", async () => {
    const now = new Date();
    for (const account of [
      { userId: "usr_feedback_tester", address: USER, email: "tester@stealth.test" },
      { userId: "usr_feedback_admin", address: ADMIN, email: "operator@stealth.test" },
    ]) {
      await repository.createUser({
        ...account,
        username: account.userId,
        status: "active",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        version: 1,
      });
      await repository.createSession({
        sessionId: `sess_${account.userId}`,
        userId: account.userId,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        lastActiveAt: now.toISOString(),
        ipAddress: "192.0.2.20",
        userAgent: "feedback-session-test",
        deviceFingerprint: "feedback-session-fingerprint",
      });
    }

    const created = await createHandler({
      request: jsonRequest(
        "/api/v1/feedback",
        "POST",
        undefined,
        submission({ steps: "Session tester reports a problem from the affected screen" }),
        { cookie: "stealth_session=sess_usr_feedback_tester" },
      ),
    });
    expect(created.status).toBe(201);

    const listed = await listHandler({
      request: new Request("https://stealth.test/api/v1/admin/feedback", {
        headers: { cookie: "stealth_session=sess_usr_feedback_admin" },
      }),
    });
    expect(listed.status).toBe(200);
    expect((await responseBody(listed)).data.reports).toHaveLength(1);
  });

  it("requires consent to exactly match diagnostics and screenshot presence", async () => {
    const diagnostics = {
      appVersion: "1.0.0",
      browser: "Firefox 128 / Linux",
      route: "/inbox",
      featureFlags: [],
      supportId: null,
      serviceStatus: "healthy",
    };
    const cases = [
      submission({ diagnosticsConsent: false, diagnostics }),
      submission({ diagnosticsConsent: true, diagnostics: null }),
      submission({ screenshotConsent: false, screenshot: { dataUrl: PNG_DATA_URL } }),
      submission({ screenshotConsent: true, screenshot: null }),
    ];

    for (const body of cases) {
      const response = await createReport(body);
      expect(response.status).toBe(422);
    }
    expect(await repository.listFeedbackReports()).toHaveLength(0);
  });

  it("redacts prose and stores only the consented diagnostics allowlist", async () => {
    const steps =
      `Open the affected screen with token=top-secret and ${PRIVATE_SEED}; ` +
      `contact tester@example.com or ${PUBLIC_ADDRESS}; Bearer abc.def.ghi then observe failure.`;
    const response = await createReport(
      submission({
        steps,
        diagnosticsConsent: true,
        diagnostics: {
          appVersion: "beta-96 token=build-secret",
          browser: "Chrome 140 / Windows Bearer browser-secret",
          route: `/mail/${PUBLIC_ADDRESS}?token=query-secret#message`,
          featureFlags: ["operator-feedback", "secret-rollout-token", "operator-feedback"],
          supportId: "sup_abcdef12",
          serviceStatus: "degraded",
        },
        screenshotConsent: true,
        screenshot: { dataUrl: PNG_DATA_URL },
      }),
    );
    expect(response.status).toBe(201);
    const reportId = (await responseBody(response)).data.reportId as string;
    const stored = await repository.getFeedbackReport(reportId);

    expect(stored).toMatchObject({
      category: "bug",
      status: "new",
      diagnosticsConsent: true,
      screenshotConsent: true,
      diagnostics: {
        route: "/mail/:address",
        featureFlags: ["operator-feedback"],
        supportId: "sup_abcdef12",
        serviceStatus: "degraded",
      },
      screenshot: { mediaType: "image/png", sizeBytes: 8 },
    });
    expect(stored?.reporterReference).toMatch(/^usr_[a-f0-9]{16}$/);
    expect(stored?.reporterReference).not.toContain(USER);

    const persistedText = JSON.stringify(stored);
    for (const secret of [
      "top-secret",
      PRIVATE_SEED,
      PUBLIC_ADDRESS,
      "tester@example.com",
      "abc.def.ghi",
      "build-secret",
      "browser-secret",
      "query-secret",
      "secret-rollout-token",
    ]) {
      expect(persistedText).not.toContain(secret);
    }
    expect(persistedText).toContain("[redacted-");

    const logs = auditSpy.mock.calls.flat().join("\n");
    expect(logs).toContain("feedback.create");
    expect(logs).not.toContain(USER);
    expect(logs).not.toContain("top-secret");
    expect(logs).not.toContain(PRIVATE_SEED);
  });

  it("enforces the 2 MiB request cap and 1 MiB decoded screenshot cap", async () => {
    const requestTooLarge = await createHandler({
      request: jsonRequest("/api/v1/feedback", "POST", USER, submission(), {
        "content-length": String(2 * 1024 * 1024 + 1),
      }),
    });
    expect(requestTooLarge.status).toBe(413);

    const oversizedBytes = Buffer.alloc(FEEDBACK_SCREENSHOT_MAX_BYTES + 1, 0);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(oversizedBytes);
    const screenshotTooLarge = await createReport(
      submission({
        screenshotConsent: true,
        screenshot: { dataUrl: `data:image/png;base64,${oversizedBytes.toString("base64")}` },
      }),
    );
    expect(screenshotTooLarge.status).toBe(413);
    expect(await repository.listFeedbackReports()).toHaveLength(0);
  });

  it("rejects spoofed screenshot media and applies per-account spam limits", async () => {
    const spoofed = await createReport(
      submission({
        screenshotConsent: true,
        screenshot: { dataUrl: "data:image/png;base64,aGVsbG8gd29ybGQ=" },
      }),
    );
    expect(spoofed.status).toBe(400);

    repository.reset();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const accepted = await createReport(
        submission({ steps: `Attempt ${attempt}: open inbox and observe the feedback problem` }),
      );
      expect(accepted.status, `attempt ${attempt}`).toBe(201);
    }
    const limited = await createReport(
      submission({ steps: "Attempt 6: open inbox and observe the feedback problem" }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();

    const otherAccount = await createReport(
      submission({ steps: "Other user can still submit an independent feedback report" }),
      OTHER_USER,
    );
    expect(otherAccount.status).toBe(201);
  });

  it("fails closed when a stored report is tampered with and never returns the extra data", async () => {
    const created = await createReport();
    const reportId = (await responseBody(created)).data.reportId as string;
    const stored = await repository.getFeedbackReport(reportId);
    await repository.setFeedbackReport({
      ...stored,
      messageBody: "tampered plaintext must never leave storage",
    } as any);

    const response = await listHandler({
      request: new Request("https://stealth.test/api/v1/admin/feedback", {
        headers: { [ACTOR_HEADER]: ADMIN },
      }),
    });
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toContain("data_integrity_error");
    expect(text).not.toContain("tampered plaintext");
    expect(text).not.toContain("messageBody");
  });

  it("restricts operator routes and completes triage, export, close, removal, and recovery", async () => {
    const created = await createReport(
      submission({
        steps: "=HYPERLINK formula-like tester input remains inert in spreadsheet export",
        screenshotConsent: true,
        screenshot: { dataUrl: PNG_DATA_URL },
      }),
    );
    const reportId = (await responseBody(created)).data.reportId as string;

    const anonymousList = await listHandler({
      request: new Request("https://stealth.test/api/v1/admin/feedback"),
    });
    expect(anonymousList.status).toBe(401);
    const userList = await listHandler({
      request: new Request("https://stealth.test/api/v1/admin/feedback", {
        headers: { [ACTOR_HEADER]: USER },
      }),
    });
    expect(userList.status).toBe(403);

    const listed = await listHandler({
      request: new Request("https://stealth.test/api/v1/admin/feedback?status=new", {
        headers: { [ACTOR_HEADER]: ADMIN },
      }),
    });
    expect(listed.status).toBe(200);
    const operatorView = (await responseBody(listed)).data.reports[0];
    expect(operatorView.screenshot).toEqual({ mediaType: "image/png", sizeBytes: 8 });
    expect(JSON.stringify(operatorView)).not.toContain("iVBORw0KGgo");

    const screenshot = await screenshotGetHandler({
      request: new Request(`https://stealth.test/api/v1/admin/feedback/${reportId}/screenshot`, {
        headers: { [ACTOR_HEADER]: ADMIN },
      }),
      params: { reportId },
    });
    expect(screenshot.status).toBe(200);
    expect(screenshot.headers.get("cache-control")).toBe("no-store");
    expect(new Uint8Array(await screenshot.arrayBuffer())).toEqual(
      Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );

    const triaged = await patchHandler({
      request: jsonRequest(`/api/v1/admin/feedback/${reportId}`, "PATCH", ADMIN, {
        expectedVersion: 1,
        reason: `Verified reproduction password=hunter2 ${PUBLIC_ADDRESS}`,
        status: "triaged",
        triageNote: `Confirmed safely; ${PRIVATE_SEED} was not retained`,
      }),
      params: { reportId },
    });
    expect(triaged.status).toBe(200);
    const triagedReport = (await responseBody(triaged)).data.report;
    expect(triagedReport.status).toBe("triaged");
    expect(triagedReport.triageNote).not.toContain(PRIVATE_SEED);

    const staleClose = await patchHandler({
      request: jsonRequest(`/api/v1/admin/feedback/${reportId}`, "PATCH", ADMIN, {
        expectedVersion: 1,
        reason: "Stale operator tab",
        status: "closed",
      }),
      params: { reportId },
    });
    expect(staleClose.status).toBe(409);

    const removed = await screenshotDeleteHandler({
      request: jsonRequest(`/api/v1/admin/feedback/${reportId}/screenshot`, "DELETE", ADMIN, {
        expectedVersion: 2,
        reason: "Tester revoked screenshot consent",
      }),
      params: { reportId },
    });
    expect(removed.status).toBe(200);
    const removedReport = (await responseBody(removed)).data.report;
    expect(removedReport).toMatchObject({ screenshot: null, screenshotConsent: true, version: 3 });

    const missingScreenshot = await screenshotGetHandler({
      request: new Request(`https://stealth.test/api/v1/admin/feedback/${reportId}/screenshot`, {
        headers: { [ACTOR_HEADER]: ADMIN },
      }),
      params: { reportId },
    });
    expect(missingScreenshot.status).toBe(404);

    const closed = await patchHandler({
      request: jsonRequest(`/api/v1/admin/feedback/${reportId}`, "PATCH", ADMIN, {
        expectedVersion: 3,
        reason: "Resolution verified",
        status: "closed",
      }),
      params: { reportId },
    });
    expect(closed.status).toBe(200);
    const closedReport = (await responseBody(closed)).data.report;
    expect(closedReport.status).toBe("closed");
    expect(closedReport.closedAt).toBeTruthy();
    expect(closedReport.closedByReference).toMatch(/^op_[a-f0-9]{16}$/);

    const reopened = await patchHandler({
      request: jsonRequest(`/api/v1/admin/feedback/${reportId}`, "PATCH", ADMIN, {
        expectedVersion: 4,
        reason: "Rollback drill",
        status: "triaged",
      }),
      params: { reportId },
    });
    expect(reopened.status).toBe(200);
    expect((await responseBody(reopened)).data.report).toMatchObject({
      status: "triaged",
      closedAt: null,
      closedByReference: null,
      version: 5,
    });

    for (const format of ["json", "csv"] as const) {
      const exported = await exportHandler({
        request: new Request(`https://stealth.test/api/v1/admin/feedback/export?format=${format}`, {
          headers: { [ACTOR_HEADER]: ADMIN },
        }),
      });
      expect(exported.status).toBe(200);
      expect(exported.headers.get("cache-control")).toBe("no-store");
      const text = await exported.text();
      expect(text).toContain(reportId);
      expect(text).not.toContain("iVBORw0KGgo");
      expect(text).not.toContain(USER);
      if (format === "csv") expect(text).toContain("'=HYPERLINK");
    }

    const fetched = await getHandler({
      request: new Request(`https://stealth.test/api/v1/admin/feedback/${reportId}`, {
        headers: { [ACTOR_HEADER]: ADMIN },
      }),
      params: { reportId },
    });
    expect(fetched.status).toBe(200);
    const auditOutput = auditSpy.mock.calls.flat().join("\n");
    expect(auditOutput).toContain('"type":"admin_mutation"');
    expect(auditOutput).toContain("[redacted-secret]");
    expect(auditOutput).not.toContain("hunter2");
    expect(auditOutput).not.toContain(PUBLIC_ADDRESS);
    expect(auditOutput).not.toContain("iVBORw0KGgo");
  });

  it("keeps helpers strict, deterministic, and free of raw identifiers", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        ...submission(),
        diagnostics: null,
        rawAddressBook: [PUBLIC_ADDRESS],
      }).success,
    ).toBe(false);
    expect(sanitizeFeedbackRoute(`/mail/${PUBLIC_ADDRESS}?token=secret`)).toBe("/mail/:address");
    expect(
      redactSensitiveText(
        `password=hunter2 ${PRIVATE_SEED} ${PUBLIC_ADDRESS} tester@example.com Bearer abc123`,
      ),
    ).toBe(
      "[redacted-secret] [redacted-seed] [redacted-address] [redacted-address] Bearer [redacted-token]",
    );
    expect(
      exportFeedbackReports(
        [
          {
            reportId: "fb_00000000-0000-0000-0000-000000000000",
            reporterReference: "usr_0000000000000000",
            category: "security",
            severity: "critical",
            steps: "@SUM(1+1) must remain text",
            diagnosticsConsent: false,
            diagnostics: null,
            screenshotConsent: false,
            screenshot: null,
            status: "new",
            triageNote: null,
            createdAt: "2026-08-28T00:00:00.000Z",
            updatedAt: "2026-08-28T00:00:00.000Z",
            closedAt: null,
            closedByReference: null,
            version: 1,
          },
        ],
        "csv",
      ),
    ).toContain("'@SUM(1+1)");
  });
});
