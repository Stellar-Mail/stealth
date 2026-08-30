/**
 * BETA-098 (#2005) — Acceptance evidence writer (local-fake).
 */
import { afterAll, describe, expect, it } from "vitest";
import metrics from "../../fixtures/beta-acceptance-metrics.json";
import {
  buildBetaFeedbackPayload,
  BetaFeedbackValidationError,
} from "../../../src/features/feedback";
import { assertNoSecretsLeaked } from "../../fixtures/identity";
import {
  writeAcceptanceReport,
  type AcceptanceStep,
  REPORT_PATH,
} from "../../e2e/beta-acceptance/run-report";
import { readFileSync } from "node:fs";

describe("BETA-098 acceptance evidence (#2005)", () => {
  const steps: AcceptanceStep[] = [];

  afterAll(() => {
    writeAcceptanceReport({
      issue: "BETA-098",
      runAt: new Date().toISOString(),
      mode: "local-fake",
      toolVersions: { vitest: "4.x", node: process.version },
      metricsTargets: metrics.targets,
      steps,
      notes:
        "Automated local-fake evidence; facilitated sessions append to gate-result-beta-098-acceptance.json",
    });
    const raw = readFileSync(REPORT_PATH, "utf-8");
    assertNoSecretsLeaked(raw);
  });

  it("loads journey metrics with explicit release targets", () => {
    expect(metrics.issue).toBe("2005");
    expect(metrics.targets.taskCompletionRate).toBeGreaterThanOrEqual(0.8);
    expect(metrics.journeys.length).toBeGreaterThanOrEqual(7);
    steps.push({
      journeyId: "metrics-fixture",
      viewport: "desktop",
      status: "pass",
      controlOwner: "product/ux",
    });
  });

  it("rejects feedback without informed consent (denial path)", () => {
    expect(() =>
      buildBetaFeedbackPayload({
        sessionId: "sess_b098_denied",
        taskId: "beta-feedback",
        category: "comprehension",
        rating: 3,
        informedConsent: false,
        viewport: "desktop",
      }),
    ).toThrow(BetaFeedbackValidationError);
    steps.push({
      journeyId: "beta-feedback-consent-denied",
      viewport: "desktop",
      status: "denied",
      controlOwner: "platform/client",
    });
  });

  it("accepts privacy-safe feedback with informed consent", () => {
    const result = buildBetaFeedbackPayload({
      sessionId: "sess_b098_evidence",
      taskId: "beta-feedback",
      category: "comprehension",
      rating: 5,
      informedConsent: true,
      viewport: "desktop",
      note: "Participant understood postage after second attempt",
    });
    expect(result.redacted.informedConsent).toBe(true);
    assertNoSecretsLeaked(JSON.stringify(result.redacted));
    steps.push({
      journeyId: "beta-feedback",
      viewport: "desktop",
      status: "pass",
      controlOwner: "platform/client",
    });
  });
});
