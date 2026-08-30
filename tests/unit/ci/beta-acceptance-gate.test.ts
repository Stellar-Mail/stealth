import { describe, expect, it } from "vitest";
import { deriveBetaAcceptanceStatus } from "../../../scripts/ci/beta-acceptance-gate-lib.mjs";

describe("BETA-098 beta-acceptance gate", () => {
  it("passes when journeys and evidence both succeed", () => {
    const derived = deriveBetaAcceptanceStatus({
      journeysOutcome: "success",
      evidence: { status: "pass", results: [{ status: "pass" }] },
    });
    expect(derived.status).toBe("pass");
  });

  it("fails when journeys fail", () => {
    const derived = deriveBetaAcceptanceStatus({
      journeysOutcome: "failure",
      evidence: { status: "pass", results: [] },
    });
    expect(derived.status).toBe("fail");
  });

  it("fails when evidence is missing", () => {
    expect(deriveBetaAcceptanceStatus({ journeysOutcome: "success" }).status).toBe("fail");
  });
});
