import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { expect, openDemoMailbox, test } from "./fixtures";

const ADMIN = "GADMIN77777777777777777777777777777777777777777777777777";
const EVIDENCE_PATH = resolve(
  process.cwd(),
  "docs/evidence/BETA-096/feedback-diagnostics-preview.png",
);
const WEB_REPORT_PATH = resolve(process.cwd(), "docs/evidence/BETA-096/feedback-web-run.json");

test.describe("BETA-096 privacy-safe beta feedback user journey", () => {
  test("previews consented data, removes an optional screenshot, and submits from the affected screen", async ({
    page,
  }) => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const actor = `G${Array.from(
      { length: 55 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("")}`;
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    // Preserve the real HTTP handler and persistence path while supplying the
    // development-only actor transport used throughout this repository's E2E suite.
    await page.route("**/api/v1/feedback", async (route) => {
      await route.continue({
        headers: { ...route.request().headers(), "x-stealth-address": actor },
      });
    });

    await openDemoMailbox(page);
    await expect(page.locator("body")).not.toHaveText("");
    await expect(
      page.locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay"),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Help" }).click();
    await page.getByRole("menuitem", { name: "Report a problem" }).click();

    const dialog = page.getByRole("dialog", { name: "Report a beta problem" });
    await expect(dialog).toBeVisible();
    const preview = dialog.getByLabel("Diagnostic data preview");
    await expect(preview).toContainText('"diagnostics": null');
    await expect(preview).toContainText('"screenshot": null');

    await dialog.getByLabel("Include privacy-safe diagnostics").click();
    await expect(preview).toContainText('"route": "/demo"');
    await expect(preview).toContainText('"serviceStatus"');
    await expect(preview).not.toContainText("userAgent");
    await expect(preview).not.toContainText("messageBody");
    await expect(preview).not.toContainText("token");

    mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
    await dialog.screenshot({ path: EVIDENCE_PATH });

    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "local-screen-with-metadata.png",
      mimeType: "image/png",
      buffer: pixel,
    });
    await expect(dialog.getByAltText("Screenshot that will be submitted")).toBeVisible();
    await dialog.getByRole("button", { name: "Remove screenshot" }).click();
    await expect(dialog.getByAltText("Screenshot that will be submitted")).toHaveCount(0);
    await expect(preview).toContainText('"screenshot": null');

    await dialog
      .getByLabel("Steps to reproduce")
      .fill("Open the inbox, choose the affected row, and observe a persistent loading state.");
    const submissionResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/feedback") && response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Submit report" }).click();
    expect((await submissionResponse).status()).toBe(201);
    await expect(dialog).not.toBeVisible();
    const submittedToast = page.getByText(/Report fb_[0-9a-f-]{36} submitted/i);
    await expect(submittedToast).toBeVisible();
    const reportId = (await submittedToast.innerText()).match(/fb_[0-9a-f-]{36}/i)?.[0];
    expect(reportId).toBeTruthy();

    const listResponse = await page.request.get("/api/v1/admin/feedback?status=new", {
      headers: { "x-stealth-address": ADMIN },
    });
    expect(listResponse.status()).toBe(200);
    const reports = (await listResponse.json()).data.reports;
    const report = reports.find((item: { reportId: string }) => item.reportId === reportId);
    expect(report).toMatchObject({
      diagnosticsConsent: true,
      screenshotConsent: false,
      screenshot: null,
      status: "new",
    });
    expect(report.diagnostics).toMatchObject({ route: "/demo" });
    expect(JSON.stringify(report)).not.toContain("local-screen-with-metadata.png");
    const featureErrors = browserErrors.filter(
      (message) =>
        !message.includes("fonts.googleapis.com") ||
        !message.includes("Content Security Policy directive"),
    );
    expect(featureErrors).toEqual([]);

    const webEvidence = {
      issue: "BETA-096 / #2003",
      runAt: new Date().toISOString(),
      environment: "production-like-local-http-stack",
      browser: `Chromium ${page.context().browser()?.version() ?? "unknown"}`,
      appVersion: report.diagnostics.appVersion,
      route: new URL(page.url()).pathname,
      reportReference: reportId,
      controls: {
        pageHasContent: true,
        frameworkErrorOverlay: false,
        featureConsoleErrors: 0,
        diagnosticsPreviewed: true,
        optionalScreenshotRemovedBeforeSubmit: true,
        persistedThroughHttpApi: true,
      },
      screenshot: {
        path: "docs/evidence/BETA-096/feedback-diagnostics-preview.png",
        sha256: createHash("sha256").update(readFileSync(EVIDENCE_PATH)).digest("hex"),
        scope: "feedback dialog only; captured before reproduction steps",
      },
    };
    writeFileSync(WEB_REPORT_PATH, `${JSON.stringify(webEvidence, null, 2)}\n`, "utf8");
  });
});
