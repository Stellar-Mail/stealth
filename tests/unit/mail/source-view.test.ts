import { describe, expect, it } from "vitest";

import { ApiClientError } from "@/lib/api";
import { classifyMailSourceError, resolveMailSourceView } from "@/features/mail/source-view";

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
  });
}

describe("classifyMailSourceError (BETA-053)", () => {
  it("maps unauthorized and expired sessions", () => {
    expect(classifyMailSourceError(apiError("unauthorized", { status: 401 })).kind).toBe(
      "unauthorized",
    );
    expect(classifyMailSourceError(apiError("session_expired", { status: 401 })).kind).toBe(
      "session_expired",
    );
    expect(classifyMailSourceError(apiError("unauthorized", { status: 401 })).retryable).toBe(
      false,
    );
  });

  it("maps offline, timeout, rate-limit, and dependency failures as retryable", () => {
    expect(classifyMailSourceError(apiError("dependency_failure"), false).kind).toBe("offline");
    expect(
      classifyMailSourceError(apiError("internal_error", { message: "Mailbox request timed out" }))
        .kind,
    ).toBe("timeout");
    expect(
      classifyMailSourceError(
        apiError("rate_limited", {
          status: 429,
          retryable: true,
          retryClassification: "rate_limited",
        }),
      ).kind,
    ).toBe("rate_limited");
    expect(
      classifyMailSourceError(
        apiError("dependency_failure", { retryable: true, retryClassification: "transient" }),
      ).kind,
    ).toBe("dependency_down");
    expect(
      classifyMailSourceError(
        apiError("conflict", { status: 409, retryable: true, retryClassification: "transient" }),
      ).kind,
    ).toBe("conflict");
  });
});

describe("resolveMailSourceView (BETA-053)", () => {
  const base = {
    isDemoMode: false,
    demoReady: true,
    sessionLoading: false,
    sessionError: undefined,
    mailboxLoading: false,
    mailboxFetching: false,
    mailboxError: undefined,
    mailboxFetched: false,
    emailCount: 0,
    online: true,
  };

  it("is loading for the first live mailbox read without fake delay", () => {
    expect(
      resolveMailSourceView({
        ...base,
        sessionLoading: true,
        mailboxLoading: true,
      }).kind,
    ).toBe("loading");
  });

  it("is empty after a successful live fetch with no rows", () => {
    expect(
      resolveMailSourceView({
        ...base,
        mailboxFetched: true,
        emailCount: 0,
      }).kind,
    ).toBe("empty");
  });

  it("is ready when live data is present", () => {
    expect(
      resolveMailSourceView({
        ...base,
        mailboxFetched: true,
        emailCount: 4,
      }),
    ).toEqual({ kind: "ready", stale: false });
  });

  it("keeps cached rows visible when the live read fails", () => {
    const view = resolveMailSourceView({
      ...base,
      mailboxError: apiError("dependency_failure", {
        retryable: true,
        retryClassification: "transient",
      }),
      emailCount: 3,
    });
    expect(view.kind).toBe("error");
    if (view.kind !== "error") throw new Error("expected error view");
    expect(view.hasCachedData).toBe(true);
    expect(view.failure.retryable).toBe(true);
    expect(view.failure.kind).toBe("dependency_down");
    expect(view.failure.actions).toContain("preserve_unsent_work");
    expect(view.failure.actions).toContain("retry");
  });

  it("classifies a live read failure as offline when the connection drops", () => {
    const view = resolveMailSourceView({
      ...base,
      online: false,
      mailboxError: apiError("internal_error", { message: "Failed to fetch" }),
      emailCount: 2,
    });
    expect(view.kind).toBe("error");
    if (view.kind !== "error") throw new Error("expected error view");
    expect(view.failure.kind).toBe("offline");
    expect(view.hasCachedData).toBe(true);
    expect(view.failure.retryable).toBe(true);
  });
});
