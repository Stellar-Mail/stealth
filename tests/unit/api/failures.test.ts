import { describe, expect, it } from "vitest";

import {
  ApiClientError,
  APP_FAILURE_KINDS,
  actionsForFailure,
  claimOnce,
  classifyAppFailure,
  offlineAppFailure,
  releaseOnce,
} from "@/lib/api";

function apiError(
  code: ConstructorParameters<typeof ApiClientError>[0]["code"],
  init: Partial<ConstructorParameters<typeof ApiClientError>[0]> = {},
) {
  return new ApiClientError({
    code,
    message: init.message ?? code,
    status: init.status ?? 500,
    retryable: init.retryable ?? false,
    retryClassification: init.retryClassification ?? "none",
    retryAfterSeconds: init.retryAfterSeconds,
    requestId: init.requestId,
  });
}

describe("classifyAppFailure (BETA-071)", () => {
  it("exposes the seven typed degraded-state kinds", () => {
    expect(APP_FAILURE_KINDS).toEqual([
      "offline",
      "timeout",
      "unauthorized",
      "rate_limited",
      "dependency_down",
      "conflict",
      "unknown",
    ]);
  });

  it("maps each kind onto retry, reauthenticate, copy-support-id, and preserve-unsent-work actions", () => {
    expect(classifyAppFailure(apiError("offline"), { online: false }).kind).toBe("offline");
    expect(classifyAppFailure(apiError("timeout", { message: "timed out" })).kind).toBe("timeout");
    expect(classifyAppFailure(apiError("unauthorized", { status: 401 })).kind).toBe("unauthorized");
    expect(classifyAppFailure(apiError("session_expired", { status: 401 })).kind).toBe(
      "unauthorized",
    );
    expect(
      classifyAppFailure(
        apiError("rate_limited", {
          status: 429,
          retryable: true,
          retryClassification: "rate_limited",
        }),
      ).kind,
    ).toBe("rate_limited");
    expect(
      classifyAppFailure(
        apiError("dependency_failure", { retryable: true, retryClassification: "transient" }),
      ).kind,
    ).toBe("dependency_down");
    expect(classifyAppFailure(apiError("conflict", { status: 409 })).kind).toBe("conflict");
    expect(classifyAppFailure(apiError("internal_error")).kind).toBe("unknown");
  });

  it("never drops unsent work and never treats a failure as success", () => {
    for (const kind of APP_FAILURE_KINDS) {
      const classified = classifyAppFailure(
        apiError(kind === "dependency_down" ? "dependency_failure" : kind),
      );
      expect(classified.preservedWork).toBe(true);
      expect(classified.actions).toContain("preserve_unsent_work");
    }
    expect(offlineAppFailure().kind).toBe("offline");
    expect(offlineAppFailure().retryable).toBe(true);
  });

  it("classifies a dropped live read (Failed to fetch) as offline", () => {
    const classified = classifyAppFailure(new TypeError("Failed to fetch"));
    expect(classified.kind).toBe("offline");
    expect(classified.retryable).toBe(true);
    expect(classified.actions).toContain("retry");
  });

  it("offers reauthenticate for expired sessions and copy support ID when present", () => {
    const expired = classifyAppFailure(
      apiError("session_expired", { status: 401, requestId: "req_abc" }),
    );
    expect(expired.actions).toContain("reauthenticate");
    expect(expired.actions).toContain("copy_support_id");
    expect(expired.supportId).toBe("req_abc");
    expect(actionsForFailure("unauthorized", "req_abc")).toEqual([
      "reauthenticate",
      "preserve_unsent_work",
      "copy_support_id",
    ]);
  });

  it("claims an in-flight mutation once so reconnect cannot duplicate send or policy edit", () => {
    const pending = new Set<string>();
    expect(claimOnce(pending, "compose-send")).toBe(true);
    expect(claimOnce(pending, "compose-send")).toBe(false);
    expect(claimOnce(pending, "policy:owner")).toBe(true);
    expect(claimOnce(pending, "policy:owner")).toBe(false);
    releaseOnce(pending, "compose-send");
    expect(claimOnce(pending, "compose-send")).toBe(true);
  });
});
