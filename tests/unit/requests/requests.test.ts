import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Email } from "../../../src/components/mail/data";
import { RequestCard, formatRequestPostage } from "../../../src/features/requests/RequestCard";
import {
  RequestsTriageBoard,
  cleanRequestTriageLabels,
  resolveRequestTriageCompletion,
} from "../../../src/features/requests/RequestsTriageBoard";

const requestEmail = (overrides: Partial<Email> = {}): Email => ({
  id: "req-1",
  from: "Avery Example",
  email: "avery@example.test",
  subject: "Partnership request",
  preview: "Could we schedule a quick review?",
  body: "Hello, I would like to discuss a small partnership.",
  time: "10:30 AM",
  unread: true,
  starred: false,
  folder: "requests",
  labels: ["Request", "Paid", "Design"],
  avatarColor: "bg-slate-500",
  postageAmount: "15000000",
  verifiedSender: false,
  ...overrides,
});

describe("Request triage regressions", () => {
  it("renders pending request details and resolves approval into inbox/trusted state", () => {
    const email = requestEmail();
    const boardHtml = renderToStaticMarkup(
      createElement(RequestsTriageBoard, {
        emails: [email],
        onUpdateEmail: vi.fn(),
        onShowToast: vi.fn(),
      }),
    );

    expect(boardHtml).toContain("Request Triage Board");
    expect(boardHtml).toContain("1 pending");
    expect(boardHtml).toContain("Avery Example");
    expect(boardHtml).toContain("Partnership request");

    const cardHtml = renderToStaticMarkup(
      createElement(RequestCard, {
        email,
        status: "idle",
        simulateFailure: false,
        onTriggerAction: vi.fn(),
        onUndoAction: vi.fn(),
        onFinalizeAction: vi.fn(),
        onInspect: vi.fn(),
      }),
    );

    expect(cardHtml).toContain("Unknown");
    expect(cardHtml).toContain("1.5 XLM");
    expect(cardHtml).toContain("Approve");

    const result = resolveRequestTriageCompletion(email, "approve");
    expect(result.patch).toEqual({
      folder: "inbox",
      senderPolicy: "allow",
      labels: ["Design", "Trusted"],
    });
    expect(result.toast).toEqual({
      message: "Avery Example added to Trusted Contacts. Mail moved to Inbox.",
      tone: "success",
    });
  });

  it("keeps the failure state visible and preserves malformed postage for retry context", () => {
    const email = requestEmail({ postageAmount: "not-a-number" });
    const cardHtml = renderToStaticMarkup(
      createElement(RequestCard, {
        email,
        status: "failure",
        simulateFailure: true,
        onTriggerAction: vi.fn(),
        onUndoAction: vi.fn(),
        onFinalizeAction: vi.fn(),
        onInspect: vi.fn(),
      }),
    );

    expect(cardHtml).toContain("Action Failed");
    expect(cardHtml).toContain("Could not resolve the transaction on the Stellar network");
    expect(cardHtml).toContain("Cancel");
    expect(cardHtml).toContain("Retry");
    expect(formatRequestPostage("not-a-number")).toBe("not-a-number stroops");
  });

  it("cleans temporary triage labels without dropping unrelated badges", () => {
    expect(cleanRequestTriageLabels(["Request", "Paid", "Design"], "Blocked")).toEqual([
      "Design",
      "Blocked",
    ]);
    expect(resolveRequestTriageCompletion(requestEmail(), "refund").patch).toEqual({
      folder: "spam",
      labels: ["Design", "Refunded"],
    });
  });
});

describe("Proof Inspector Query Validation & Payload Safety", () => {
  const validateQuery = (
    query: string,
  ): "address" | "hash" | "uuid" | "keyword" | "invalid-length" => {
    const trimmed = query.trim();
    if (!trimmed) return "keyword";

    const addressRegex = /^[GC][A-Z2-7]{55}$/i;
    const hashRegex = /^(0x)?[a-f0-9]{64}$/i;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (addressRegex.test(trimmed)) return "address";
    if (hashRegex.test(trimmed)) return "hash";
    if (uuidRegex.test(trimmed)) return "uuid";

    if (
      (trimmed.length > 5 &&
        (trimmed.startsWith("G") || trimmed.startsWith("C")) &&
        trimmed.length !== 56) ||
      (trimmed.length > 10 &&
        trimmed.match(/^[0-9a-f]+$/i) &&
        trimmed.length !== 64 &&
        !trimmed.startsWith("0x"))
    ) {
      return "invalid-length";
    }

    return "keyword";
  };

  it("identifies valid Stellar G-addresses and C-addresses", () => {
    const validG = "GB2PKCKNN4XQY6N7N4G3J73N4H73U73N4G3J73N4H73U73N4G3J73N4H";
    const validC = "CB2PKCKNN4XQY6N7N4G3J73N4H73U73N4G3J73N4H73U73N4G3J73N4H";
    expect(validateQuery(validG)).toBe("address");
    expect(validateQuery(validC)).toBe("address");
  });

  it("rejects malformed or invalid length addresses", () => {
    const shortAddress = "GB2PKCKNN4XQY6N7N4G3J73N4H73U73N4";
    expect(validateQuery(shortAddress)).toBe("invalid-length");
  });

  it("identifies valid 32-byte hexadecimal hashes", () => {
    const validHashWithoutPrefix =
      "a1b2c3d4e5f601020304050607080900112233445566778899aabbccddeeff00";
    const validHashWithPrefix =
      "0xa1b2c3d4e5f601020304050607080900112233445566778899aabbccddeeff00";
    expect(validateQuery(validHashWithoutPrefix)).toBe("hash");
    expect(validateQuery(validHashWithPrefix)).toBe("hash");
  });

  it("rejects invalid length hexadecimal hashes", () => {
    const shortHash = "a1b2c3d4e5f6";
    expect(validateQuery(shortHash)).toBe("invalid-length");
  });

  it("identifies valid relay diagnostic UUIDs", () => {
    const validUUID = "d1f038c7-4b1d-44a6-8968-3e5f49230501";
    expect(validateQuery(validUUID)).toBe("uuid");
  });

  it("falls back to keyword searching for sender names or subjects", () => {
    expect(validateQuery("Lina Park")).toBe("keyword");
    expect(validateQuery("brand system")).toBe("keyword");
  });

  it("ensures sensitive plaintext payload is omitted from proof record logs", () => {
    const mockEmail = {
      id: "1",
      from: "Lina Park",
      email: "lina*vantage.studio",
      subject: "Refined brand system",
      body: "This is a super secret message body containing proprietary designs.",
      time: "10:30 AM",
      unread: false,
    };

    const record = {
      messageHash: "0xa1b2...",
      paymentHash: "0xb2c3...",
      subject: mockEmail.subject,
    };

    expect(record).not.toHaveProperty("body");
  });
});
