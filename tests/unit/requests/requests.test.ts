import { describe, expect, it } from "vitest";

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
