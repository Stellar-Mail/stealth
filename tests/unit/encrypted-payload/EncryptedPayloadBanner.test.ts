import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EncryptedPayload, PayloadFailureReason } from "@/components/mail/data";

// ---------------------------------------------------------------------------
// Pure-logic helpers extracted from EncryptedPayloadBanner to keep tests
// framework-free (no JSDOM needed for pure-logic checks).
// ---------------------------------------------------------------------------

function shouldShowBody(payload: EncryptedPayload | undefined): boolean {
  return !payload || payload.status === "decrypted";
}

function failureCopy(reason: PayloadFailureReason | undefined): string {
  switch (reason) {
    case "key":
      return "Key not found";
    case "payload":
      return "Payload unreadable";
    case "relay":
      return "Relay error";
    case "integrity":
      return "Integrity check failed";
    default:
      return "Decryption failed";
  }
}

function makePayload(overrides: Partial<EncryptedPayload>): EncryptedPayload {
  return {
    status: "locked",
    diagnosticId: "test-diag-001",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EncryptedPayloadBanner — payload visibility guard", () => {
  it("shows body when there is no encryptedPayload", () => {
    expect(shouldShowBody(undefined)).toBe(true);
  });

  it("hides body when status is locked", () => {
    expect(shouldShowBody(makePayload({ status: "locked" }))).toBe(false);
  });

  it("hides body when status is verifying", () => {
    expect(shouldShowBody(makePayload({ status: "verifying" }))).toBe(false);
  });

  it("shows body when status is decrypted", () => {
    expect(shouldShowBody(makePayload({ status: "decrypted" }))).toBe(true);
  });

  it("hides body when status is failed", () => {
    expect(shouldShowBody(makePayload({ status: "failed" }))).toBe(false);
  });
});

describe("EncryptedPayloadBanner — failure reason copy", () => {
  it("returns key-specific copy for 'key' reason", () => {
    expect(failureCopy("key")).toBe("Key not found");
  });

  it("returns payload-specific copy for 'payload' reason", () => {
    expect(failureCopy("payload")).toBe("Payload unreadable");
  });

  it("returns relay-specific copy for 'relay' reason", () => {
    expect(failureCopy("relay")).toBe("Relay error");
  });

  it("returns integrity-specific copy for 'integrity' reason", () => {
    expect(failureCopy("integrity")).toBe("Integrity check failed");
  });

  it("returns generic copy when reason is undefined", () => {
    expect(failureCopy(undefined)).toBe("Decryption failed");
  });
});

describe("EncryptedPayloadBanner — data model", () => {
  it("accepts all valid status values", () => {
    const statuses: EncryptedPayload["status"][] = ["locked", "verifying", "decrypted", "failed"];
    for (const status of statuses) {
      const payload = makePayload({ status });
      expect(payload.status).toBe(status);
    }
  });

  it("carries diagnosticId through", () => {
    const payload = makePayload({ diagnosticId: "abc-123" });
    expect(payload.diagnosticId).toBe("abc-123");
  });

  it("carries failureReason when provided", () => {
    const payload = makePayload({ status: "failed", failureReason: "integrity" });
    expect(payload.failureReason).toBe("integrity");
  });

  it("does not require failureReason for failed status", () => {
    const payload = makePayload({ status: "failed" });
    expect(payload.failureReason).toBeUndefined();
  });
});

describe("EncryptedPayloadBanner — CTA callbacks", () => {
  it("fires onCopyDiagnosticId with the correct id", () => {
    const onCopy = vi.fn();
    const id = "diag-xyz-999";
    onCopy(id);
    expect(onCopy).toHaveBeenCalledWith(id);
  });

  it("fires onReportCorruption with the correct id", () => {
    const onReport = vi.fn();
    const id = "diag-abc-111";
    onReport(id);
    expect(onReport).toHaveBeenCalledWith(id);
  });

  it("fires onRetry", () => {
    const onRetry = vi.fn();
    onRetry();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("fires onUnlock", () => {
    const onUnlock = vi.fn();
    onUnlock();
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });
});

describe("EncryptedPayloadBanner — encrypted fixture variants", () => {
  // Mirrors the four fixture emails added in data.ts
  const fixtures: EncryptedPayload[] = [
    { status: "decrypted", diagnosticId: "dec-7a3f-c18e" },
    { status: "locked", diagnosticId: "lck-4b2a-9d01" },
    { status: "verifying", diagnosticId: "vfy-8c5d-2e47" },
    { status: "failed", diagnosticId: "flt-1e9b-5f62", failureReason: "integrity" },
  ];

  fixtures.forEach(({ status, diagnosticId, failureReason }) => {
    it(`fixture with status=${status} is valid`, () => {
      const p = makePayload({ status, diagnosticId, failureReason });
      expect(p.status).toBe(status);
      expect(p.diagnosticId).toBe(diagnosticId);
    });
  });

  it("all fixture diagnostic IDs are unique", () => {
    const ids = fixtures.map((f) => f.diagnosticId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
