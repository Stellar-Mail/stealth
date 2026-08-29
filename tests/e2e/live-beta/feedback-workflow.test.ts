/**
 * BETA-096 production-like local evidence.
 *
 * Exercises the real route handlers, authorization, repository adapter, size
 * controls, operations workflow, export, screenshot removal, and rollback.
 * The emitted report contains only allowlisted identifiers and status codes.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { Route as FeedbackRoute } from "@/routes/api/v1/feedback/index";
import { Route as AdminFeedbackRoute } from "@/routes/api/v1/admin/feedback/index";
import { Route as AdminFeedbackItemRoute } from "@/routes/api/v1/admin/feedback/$reportId";
import { Route as AdminFeedbackScreenshotRoute } from "@/routes/api/v1/admin/feedback/$reportId/screenshot";
import { Route as AdminFeedbackExportRoute } from "@/routes/api/v1/admin/feedback/export";
import { ACTOR_HEADER } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import type { MemoryApiRepository } from "@/server/api/memory-repository";
import { assertNoSecretsLeaked } from "../../fixtures/identity";

const REPORT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "feedback-run-report.json");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const USER = `G${"E".repeat(55)}`;
const ADMIN = "GADMIN77777777777777777777777777777777777777777777777777";
const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgo=";

const createHandler = (FeedbackRoute.options as any).server.handlers.POST;
const listHandler = (AdminFeedbackRoute.options as any).server.handlers.GET;
const patchHandler = (AdminFeedbackItemRoute.options as any).server.handlers.PATCH;
const screenshotDeleteHandler = (AdminFeedbackScreenshotRoute.options as any).server.handlers
  .DELETE;
const exportHandler = (AdminFeedbackExportRoute.options as any).server.handlers.GET;

interface EvidenceStep {
  control: string;
  status: "pass" | "fail";
  owner: string;
  result: Record<string, unknown>;
}

const steps: EvidenceStep[] = [];
let repository: MemoryApiRepository;
let reportId = "";

function request(path: string, method: string, actor?: string, body?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (actor) headers[ACTOR_HEADER] = actor;
  return new Request(`https://stealth.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function implementationManifest(): string {
  const files = [
    "src/features/feedback/FeedbackDialog.tsx",
    "src/features/feedback/diagnostics.ts",
    "src/features/admin/FeedbackOperations.tsx",
    "src/server/api/feedback-service.ts",
    "src/server/api/domain.ts",
    "src/routes/api/v1/feedback/index.ts",
    "src/routes/api/v1/admin/feedback/index.ts",
    "src/routes/api/v1/admin/feedback/$reportId.ts",
    "src/routes/api/v1/admin/feedback/$reportId/screenshot.ts",
    "src/routes/api/v1/admin/feedback/export.ts",
    "src/server/api/openapi.ts",
    "playwright.config.ts",
  ];
  const hash = createHash("sha256");
  for (const file of files.sort())
    hash
      .update(file)
      .update("\0")
      .update(readFileSync(resolve(ROOT, file)));
  return `sha256:${hash.digest("hex")}`;
}

function writeEvidence() {
  const packageJson = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const installedVersion = (name: string) =>
    JSON.parse(readFileSync(resolve(ROOT, "node_modules", name, "package.json"), "utf8")).version;
  const report = {
    issue: "BETA-096 / #2003",
    runAt: new Date().toISOString(),
    environment: "production-like-local-route-stack",
    source: {
      branch: execFileSync("git", ["branch", "--show-current"], {
        cwd: ROOT,
        encoding: "utf8",
      }).trim(),
      baseCommit: "00309a7c35c55613700c7e850c776c468d649d1d",
      implementationManifest: implementationManifest(),
      wranglerManifest: `sha256:${createHash("sha256")
        .update(readFileSync(resolve(ROOT, "wrangler.jsonc")))
        .digest("hex")}`,
    },
    toolVersions: {
      node: process.version,
      bun: packageJson.packageManager,
      vite: installedVersion("vite"),
      vitest: installedVersion("vitest"),
      playwright: installedVersion("@playwright/test"),
      typescript: installedVersion("typescript"),
    },
    controls: steps,
    artifactPolicy:
      "allowlisted identifiers and status codes only; raw actors and screenshot bytes excluded",
  };
  assertNoSecretsLeaked(report);
  const serialized = JSON.stringify(report, null, 2) + "\n";
  if (/Bearer\s+|Password123|\bS[A-Z2-7]{55}\b|BEGIN PRIVATE KEY/i.test(serialized)) {
    throw new Error("Feedback evidence contains prohibited plaintext material");
  }
  writeFileSync(REPORT_PATH, serialized, "utf8");
}

describe("BETA-096 production-like feedback operator and beta-user journey", () => {
  beforeAll(async () => {
    repository = (await getApiContext()).repository as MemoryApiRepository;
    repository.reset();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterAll(() => {
    vi.restoreAllMocks();
    writeEvidence();
  });

  it("records authentication denial and one successful privacy-safe submission", async () => {
    const body = {
      category: "usability",
      severity: "medium",
      steps: "Open the affected screen, choose the action, and observe the stale state.",
      diagnosticsConsent: true,
      diagnostics: {
        appVersion: "beta-096",
        browser: "Chrome 140 / Windows",
        route: "/demo",
        featureFlags: ["operator-feedback"],
        supportId: "sup_abcdef12",
        serviceStatus: "healthy",
      },
      screenshotConsent: true,
      screenshot: { dataUrl: PNG_DATA_URL },
    };
    const denied = await createHandler({
      request: request("/api/v1/feedback", "POST", undefined, body),
    });
    expect(denied.status).toBe(401);
    steps.push({
      control: "anonymous-submission-denied",
      status: "pass",
      owner: "api-auth",
      result: { httpStatus: 401 },
    });

    const accepted = await createHandler({
      request: request("/api/v1/feedback", "POST", USER, body),
    });
    expect(accepted.status).toBe(201);
    reportId = (await accepted.json()).data.reportId;
    steps.push({
      control: "consented-report-created",
      status: "pass",
      owner: "feedback-api",
      result: { httpStatus: 201, reportReference: reportId, diagnostics: true, screenshot: true },
    });
  });

  it("records oversized input denial without persistence", async () => {
    const response = await createHandler({
      request: new Request("https://stealth.test/api/v1/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(2 * 1024 * 1024 + 1),
          [ACTOR_HEADER]: `G${"F".repeat(55)}`,
        },
        body: "{}",
      }),
    });
    expect(response.status).toBe(413);
    steps.push({
      control: "oversized-request-denied",
      status: "pass",
      owner: "api-security",
      result: { httpStatus: 413, configuredLimitBytes: 2 * 1024 * 1024 },
    });
  });

  it("triages, proves conflict denial, removes screenshot, closes, and rolls back", async () => {
    const listed = await listHandler({
      request: new Request("https://stealth.test/api/v1/admin/feedback", {
        headers: { [ACTOR_HEADER]: ADMIN },
      }),
    });
    expect(listed.status).toBe(200);
    expect((await listed.json()).data.reports).toHaveLength(1);

    const triaged = await patchHandler({
      request: request(`/api/v1/admin/feedback/${reportId}`, "PATCH", ADMIN, {
        expectedVersion: 1,
        reason: "Evidence journey triage",
        status: "triaged",
        triageNote: "Reproduced on the production-like local route stack",
      }),
      params: { reportId },
    });
    expect(triaged.status).toBe(200);

    const conflict = await patchHandler({
      request: request(`/api/v1/admin/feedback/${reportId}`, "PATCH", ADMIN, {
        expectedVersion: 1,
        reason: "Stale console denial",
        status: "closed",
      }),
      params: { reportId },
    });
    expect(conflict.status).toBe(409);

    const removed = await screenshotDeleteHandler({
      request: request(`/api/v1/admin/feedback/${reportId}/screenshot`, "DELETE", ADMIN, {
        expectedVersion: 2,
        reason: "Screenshot retention removal drill",
      }),
      params: { reportId },
    });
    expect(removed.status).toBe(200);
    expect((await removed.json()).data.report.screenshot).toBeNull();

    const closed = await patchHandler({
      request: request(`/api/v1/admin/feedback/${reportId}`, "PATCH", ADMIN, {
        expectedVersion: 3,
        reason: "Successful resolution",
        status: "closed",
      }),
      params: { reportId },
    });
    expect(closed.status).toBe(200);

    const reopened = await patchHandler({
      request: request(`/api/v1/admin/feedback/${reportId}`, "PATCH", ADMIN, {
        expectedVersion: 4,
        reason: "Rollback and recovery drill",
        status: "triaged",
      }),
      params: { reportId },
    });
    expect(reopened.status).toBe(200);
    expect((await reopened.json()).data.report.status).toBe("triaged");

    steps.push(
      {
        control: "stale-operator-write-denied",
        status: "pass",
        owner: "feedback-operations",
        result: { httpStatus: 409, recovery: "refresh-and-retry" },
      },
      {
        control: "triage-close-screenshot-removal-rollback",
        status: "pass",
        owner: "feedback-operations",
        result: { screenshotRemoved: true, closed: true, recoveryState: "triaged", version: 5 },
      },
    );
  });

  it("exports an operator-safe report with screenshot bytes excluded", async () => {
    const exported = await exportHandler({
      request: new Request("https://stealth.test/api/v1/admin/feedback/export?format=json", {
        headers: { [ACTOR_HEADER]: ADMIN },
      }),
    });
    expect(exported.status).toBe(200);
    const text = await exported.text();
    expect(text).toContain(reportId);
    expect(text).not.toContain("iVBORw0KGgo");
    expect(text).not.toContain(USER);
    assertNoSecretsLeaked(text);
    steps.push({
      control: "redacted-export",
      status: "pass",
      owner: "feedback-operations",
      result: { httpStatus: 200, reportCount: 1, screenshotBytesExcluded: true },
    });
  });
});
