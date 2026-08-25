/**
 * BETA-088 — derive security / crypto gate status from step outcomes and evidence.
 * Process exit codes are not trusted on their own.
 */

export function deriveSecretScanStatus({
  forkPr = false,
  depReview = "skipped",
  gitleaksInstall = "skipped",
  gitleaksScan = "skipped",
} = {}) {
  if (forkPr === true || forkPr === "true") {
    return {
      status: "skipped",
      message: "Fork PR — dependency review and Gitleaks skipped",
    };
  }

  if (gitleaksInstall === "failure") {
    return { status: "fail", message: "Gitleaks installation failed" };
  }
  if (gitleaksScan === "failure") {
    return { status: "fail", message: "Gitleaks history scan failed" };
  }
  if (depReview === "failure") {
    return { status: "fail", message: "Dependency review failed" };
  }

  const scansRan =
    gitleaksInstall === "success" &&
    gitleaksScan === "success" &&
    (depReview === "success" || depReview === "skipped");

  if (!scansRan) {
    return { status: "fail", message: "Required secret-scan steps did not complete" };
  }

  return { status: "pass", message: null };
}

export function deriveBetaSecurityStatus({ cryptoOutcome, evidence } = {}) {
  if (cryptoOutcome === "failure") {
    return {
      status: "fail",
      message: "Crypto or managed-wallet tests failed",
    };
  }

  if (!evidence || typeof evidence !== "object") {
    return {
      status: "fail",
      message: "missing required gate result",
    };
  }

  const unexpectedFail =
    evidence.status === "fail" ||
    (Array.isArray(evidence.results) && evidence.results.some((r) => r.status === "fail"));
  if (unexpectedFail) {
    return {
      status: "fail",
      message: evidence.message ?? "Unexpected security test failure",
    };
  }

  const knownBlocked = Array.isArray(evidence.knownBlockedControls)
    ? evidence.knownBlockedControls
    : [];
  const reportedBlocked =
    evidence.status === "blocked" ||
    knownBlocked.length > 0 ||
    (Array.isArray(evidence.results) && evidence.results.some((r) => r.status === "blocked"));

  if (reportedBlocked) {
    return {
      status: "blocked",
      message:
        evidence.message ??
        "Isolation regressions still failing (#1555/#1986/#1991) — crypto/managed-wallet pass; owner: security/platform",
    };
  }

  if (cryptoOutcome === "success" && evidence.status === "pass") {
    return { status: "pass", message: null };
  }

  return { status: "fail", message: "incomplete security evidence" };
}
