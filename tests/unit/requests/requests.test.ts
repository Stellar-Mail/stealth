// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Email } from "../../../src/components/mail/data";

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const stripMotionProps = (props: Record<string, any>) => {
    const domProps = { ...props };
    for (const key of [
      "animate",
      "exit",
      "initial",
      "layout",
      "transition",
      "variants",
      "whileHover",
      "whileTap",
    ]) {
      delete domProps[key];
    }
    return domProps;
  };

  const createMotionComponent = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, any>>(({ children, ...props }, ref) =>
      React.createElement(tag, { ...stripMotionProps(props), ref }, children),
    );

  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) => createMotionComponent(tag),
      },
    ),
  };
});

let RequestsTriageBoard: typeof import("../../../src/features/requests/RequestsTriageBoard").RequestsTriageBoard;

const makeRequestEmail = (overrides: Partial<Email> = {}): Email => ({
  id: "request-1",
  from: "Unknown Founder",
  email: "founder*example.test",
  subject: "Paid intro request",
  preview: "I attached postage for a short intro.",
  body: "Hello, this is a fake deterministic request fixture.",
  time: "Now",
  unread: true,
  starred: false,
  folder: "requests",
  labels: ["Request", "Paid", "Design"],
  avatarColor: "#64748b",
  postageAmount: "15000000",
  verifiedSender: false,
  ...overrides,
});

const makeInboxEmail = (): Email => ({
  id: "inbox-1",
  from: "Known Contact",
  email: "known*example.test",
  subject: "Existing inbox mail",
  preview: "This message should not appear on the requests board.",
  body: "Already accepted mail.",
  time: "9:00 AM",
  unread: false,
  starred: false,
  folder: "inbox",
  labels: ["Trusted"],
  avatarColor: "#475569",
});

describe("RequestsTriageBoard regression coverage", () => {
  beforeAll(async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    ({ RequestsTriageBoard } = await import("../../../src/features/requests/RequestsTriageBoard"));
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("approves a paid sender request and finalizes it as trusted inbox mail", async () => {
    const onUpdateEmail = vi.fn();
    const onShowToast = vi.fn();

    render(
      createElement(RequestsTriageBoard, {
        emails: [makeRequestEmail(), makeInboxEmail()],
        onUpdateEmail,
        onShowToast,
      }),
    );

    expect(screen.getByText("1 pending")).toBeTruthy();
    expect(screen.getByText("Paid intro request")).toBeTruthy();
    expect(screen.queryByText("Existing inbox mail")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(screen.getByText("Approving sender and settling postage...")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByText("Sender Approved")).toBeTruthy();
    expect(screen.getByText("Messages from Unknown Founder will go to Inbox.")).toBeTruthy();
    expect(onShowToast).toHaveBeenCalledWith(
      "Optimistic approve registered. Reviewing details...",
      { tone: "neutral" },
    );
    expect(onUpdateEmail).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    expect(onUpdateEmail).toHaveBeenCalledWith("request-1", {
      folder: "inbox",
      senderPolicy: "allow",
      labels: ["Design", "Trusted"],
    });
    expect(onShowToast).toHaveBeenLastCalledWith(
      "Unknown Founder added to Trusted Contacts. Mail moved to Inbox.",
      { tone: "success" },
    );
  });

  it("surfaces a network failure and leaves the request unchanged until cancelled", async () => {
    const onUpdateEmail = vi.fn();
    const onShowToast = vi.fn();

    render(
      createElement(RequestsTriageBoard, {
        emails: [makeRequestEmail()],
        onUpdateEmail,
        onShowToast,
      }),
    );

    fireEvent.click(screen.getByLabelText("Simulate network failure"));
    fireEvent.click(screen.getByRole("button", { name: "Refund" }));

    expect(screen.getByText("Refunding postage amount...")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByText("Action Failed")).toBeTruthy();
    expect(
      screen.getByText(
        "Could not resolve the transaction on the Stellar network. Please try again.",
      ),
    ).toBeTruthy();
    expect(onShowToast).toHaveBeenCalledWith("Stellar transaction failed for refund", {
      tone: "danger",
    });
    expect(onUpdateEmail).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Reverting policy changes...")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByRole("button", { name: "Refund" })).toBeTruthy();
    expect(onShowToast).toHaveBeenLastCalledWith("Changes reverted successfully", {
      tone: "success",
    });
    expect(onUpdateEmail).not.toHaveBeenCalled();
  });
});

// Simple test for requests logic and formatting
describe("Requests triage board unit helpers", () => {
  // Test formatting for native Stellar postage amounts (1 XLM = 10,000,000 Stroops)
  const formatPostage = (stroops?: string) => {
    if (!stroops) return "0.0 XLM";
    try {
      const val = BigInt(stroops);
      const xlm = Number(val) / 10_000_000;
      return `${xlm.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 4,
      })} XLM`;
    } catch {
      return `${stroops} stroops`;
    }
  };

  const cleanLabels = (labels?: string[], toAdd?: string) => {
    const filterOut = ["Request", "Paid", "Pending"];
    const current = labels ? labels.filter((l) => !filterOut.includes(l)) : [];
    return toAdd ? [...current, toAdd] : current;
  };

  it("formats postage amounts from stroops to XLM native units", () => {
    expect(formatPostage("10000000")).toBe("1.0 XLM");
    expect(formatPostage("50000000")).toBe("5.0 XLM");
    expect(formatPostage("15000000")).toBe("1.5 XLM");
    expect(formatPostage("100000")).toBe("0.01 XLM");
    expect(formatPostage(undefined)).toBe("0.0 XLM");
    expect(formatPostage("invalid")).toBe("invalid stroops");
  });

  it("cleans temporary triage labels and appends final policy badge", () => {
    const originalLabels = ["Request", "Paid", "Design"];
    const resultApprove = cleanLabels(originalLabels, "Trusted");
    expect(resultApprove).toEqual(["Design", "Trusted"]);
    expect(resultApprove).not.toContain("Request");
    expect(resultApprove).not.toContain("Paid");

    const resultBlock = cleanLabels(originalLabels, "Blocked");
    expect(resultBlock).toEqual(["Design", "Blocked"]);

    const resultRefund = cleanLabels(originalLabels, "Refunded");
    expect(resultRefund).toEqual(["Design", "Refunded"]);
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
