import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { signPostageQuote, verifyPostageQuote } from "../../../src/server/api/postage-quote";

const binding = {
  sender: `G${"A".repeat(55)}`,
  recipient: `G${"B".repeat(55)}`,
  messageId: "a".repeat(64),
  amount: "100",
  policyVersion: 1,
};

describe("postage quote token (issue #1544)", () => {
  beforeEach(() => {
    process.env.STEALTH_POSTAGE_QUOTE_SECRET = "test-postage-quote-secret";
  });

  afterEach(() => {
    delete process.env.STEALTH_POSTAGE_QUOTE_SECRET;
  });

  it("round-trips: a signed token verifies against its own binding", () => {
    const token = signPostageQuote(binding);
    expect(() => verifyPostageQuote(token, binding)).not.toThrow();
  });

  it("is deterministic-shaped: version.signature.encoded with three parts", () => {
    const token = signPostageQuote(binding);
    expect(token.split(".")).toHaveLength(3);
    expect(token.startsWith("1.")).toBe(true);
  });

  it("leaks no server secret in the token", () => {
    const token = signPostageQuote(binding);
    expect(token).not.toContain("test-postage-quote-secret");
  });

  it("rejects a substituted sender", () => {
    const token = signPostageQuote(binding);
    expect(() => verifyPostageQuote(token, { ...binding, sender: `G${"Z".repeat(55)}` })).toThrow(
      /does not match/,
    );
  });

  it("rejects a substituted recipient", () => {
    const token = signPostageQuote(binding);
    expect(() =>
      verifyPostageQuote(token, { ...binding, recipient: `G${"Z".repeat(55)}` }),
    ).toThrow(/does not match/);
  });

  it("rejects a substituted messageId", () => {
    const token = signPostageQuote(binding);
    expect(() => verifyPostageQuote(token, { ...binding, messageId: "b".repeat(64) })).toThrow(
      /does not match/,
    );
  });

  it("rejects a substituted amount", () => {
    const token = signPostageQuote(binding);
    expect(() => verifyPostageQuote(token, { ...binding, amount: "999" })).toThrow(
      /does not match/,
    );
  });

  it("rejects a substituted policyVersion (stale quote after policy change)", () => {
    const token = signPostageQuote(binding);
    expect(() => verifyPostageQuote(token, { ...binding, policyVersion: 2 })).toThrow(
      /does not match/,
    );
  });

  it("rejects a tampered token", () => {
    const token = signPostageQuote(binding);
    const [version, signature, encoded] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...binding, v: 1, amount: "999999" }),
      "utf8",
    ).toString("base64url");
    const tampered = `${version}.${signature}.${tamperedPayload}`;
    expect(() => verifyPostageQuote(tampered, binding)).toThrow(/Tampered/);
  });

  it("rejects a malformed token", () => {
    expect(() => verifyPostageQuote("not-a-valid-token", binding)).toThrow(/Invalid/);
  });

  it("rejects an unsupported token version", () => {
    const token = signPostageQuote(binding);
    const [, signature, encoded] = token.split(".");
    const bumped = `2.${signature}.${encoded}`;
    expect(() => verifyPostageQuote(bumped, binding)).toThrow(/Unsupported/);
  });

  it("throws internal_error when the signing secret is not configured", () => {
    delete process.env.STEALTH_POSTAGE_QUOTE_SECRET;
    expect(() => signPostageQuote(binding)).toThrow(/signing secret is not configured/);
  });
});
