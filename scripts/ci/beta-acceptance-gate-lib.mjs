/**
 * BETA-098 — derive usability/accessibility acceptance gate status.
 */

export function deriveBetaAcceptanceStatus({ journeysOutcome, evidence } = {}) {
  if (journeysOutcome === "failure") {
    return { status: "fail", message: "Acceptance journey Playwright spec failed" };
  }

  if (!evidence || typeof evidence !== "object") {
    return { status: "fail", message: "missing required gate result" };
  }

  const unexpectedFail =
    evidence.status === "fail" ||
    (Array.isArray(evidence.results) && evidence.results.some((r) => r.status === "fail"));
  if (unexpectedFail) {
    return {
      status: "fail",
      message: evidence.message ?? "Unexpected acceptance test failure",
    };
  }

  if (evidence.status === "pass" && journeysOutcome === "success") {
    return { status: "pass", message: null };
  }

  return { status: "fail", message: "incomplete acceptance evidence" };
}
