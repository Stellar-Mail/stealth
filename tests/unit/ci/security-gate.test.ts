import { describe, expect, it } from "vitest";
import {
  deriveBetaSecurityStatus,
  deriveSecretScanStatus,
} from "../../../scripts/ci/security-gate-lib.mjs";

describe("BETA-088 security gate derivation", () => {
  it("blocks expected-failure / known blocked controls even when the process succeeded", () => {
    const result = deriveBetaSecurityStatus({
      cryptoOutcome: "success",
      evidence: {
        status: "pass",
        knownBlockedControls: [{ control: "signed-request", issue: "#1555" }],
      },
    });
    expect(result.status).toBe("blocked");
  });

  it("fails on unexpected security failures", () => {
    const result = deriveBetaSecurityStatus({
      cryptoOutcome: "success",
      evidence: {
        status: "fail",
        results: [{ status: "fail", label: "unexpected" }],
      },
    });
    expect(result.status).toBe("fail");
  });

  it("passes only when crypto succeeded and evidence has no blocked controls", () => {
    const result = deriveBetaSecurityStatus({
      cryptoOutcome: "success",
      evidence: { status: "pass", results: [{ status: "pass" }], knownBlockedControls: [] },
    });
    expect(result.status).toBe("pass");
  });

  it("fails when Gitleaks scan fails even if dependency review passed", () => {
    const result = deriveSecretScanStatus({
      forkPr: false,
      depReview: "success",
      gitleaksInstall: "success",
      gitleaksScan: "failure",
    });
    expect(result.status).toBe("fail");
    expect(result.message).toMatch(/Gitleaks/i);
  });

  it("fails when Gitleaks installation fails", () => {
    const result = deriveSecretScanStatus({
      forkPr: false,
      depReview: "success",
      gitleaksInstall: "failure",
      gitleaksScan: "skipped",
    });
    expect(result.status).toBe("fail");
  });

  it("fails when dependency review fails", () => {
    const result = deriveSecretScanStatus({
      forkPr: false,
      depReview: "failure",
      gitleaksInstall: "success",
      gitleaksScan: "success",
    });
    expect(result.status).toBe("fail");
  });

  it("passes when all required secret scans succeed", () => {
    const result = deriveSecretScanStatus({
      forkPr: false,
      depReview: "success",
      gitleaksInstall: "success",
      gitleaksScan: "success",
    });
    expect(result.status).toBe("pass");
  });

  it("skips privileged scans on fork PRs instead of converting them to pass", () => {
    const result = deriveSecretScanStatus({
      forkPr: true,
      depReview: "success",
      gitleaksInstall: "skipped",
      gitleaksScan: "skipped",
    });
    expect(result.status).toBe("skipped");
  });
});
