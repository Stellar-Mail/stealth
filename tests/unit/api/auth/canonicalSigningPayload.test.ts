import { readFileSync } from "node:fs";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildCanonicalSigningPayload,
  canonicalizeRoute,
  verifyCanonicalRequest,
} from "../../../../src/server/api/auth/canonicalSigningPayload";
import { computeBodyHash } from "../../../../src/server/api/auth/bodyHash";
import { canonicalJson } from "../../../../src/server/api/auth/canonicalJson";

interface FixtureData {
  version: string;
  audience: string;
  now: string;
  fixtures: Array<{
    name: string;
    version?: string;
    method?: string;
    route?: string;
    body?: unknown;
    nonce?: string;
    issuedAt?: string;
    audience?: string;
    expectedCanonical?: string;
    expectedBodyHash?: string;
    expectedRoute?: string;
  }>;
}

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../../test-fixtures/auth/canonical-signing-v1.json", import.meta.url),
    "utf8",
  ),
) as FixtureData;

describe("Canonical Request Signing System (v1)", () => {
  // Generate keypair for testing asymmetric request signatures
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeySpkiDer = publicKey.export({ type: "spki", format: "der" });

  const validRequest = {
    version: "v1",
    method: "POST",
    route: "/api/auth/login",
    body: { a: 1, b: 2 },
    nonce: "nonce-12345",
    issuedAt: "2026-07-23T00:00:00.000Z",
    audience: "remitflow-api",
  };

  function signPayload(payload: string): string {
    return cryptoSign(null, Buffer.from(payload, "utf8"), privateKey).toString("base64");
  }

  it("✓ valid request verifies successfully", () => {
    const payload = buildCanonicalSigningPayload(validRequest);
    const signature = signPayload(payload);

    const result = verifyCanonicalRequest({
      ...validRequest,
      signature,
      expectedAudience: "remitflow-api",
      expectedMethod: "POST",
      expectedRoute: "/api/auth/login",
      publicKeyOrSecret: publicKeySpkiDer,
      nowMs: Date.parse("2026-07-23T00:01:00.000Z"),
    });

    expect(result.valid).toBe(true);
    expect(result.canonicalPayload).toBe(payload);
  });

  it("✓ method changed (POST -> GET) must fail", () => {
    const payload = buildCanonicalSigningPayload(validRequest);
    const signature = signPayload(payload);

    const result = verifyCanonicalRequest({
      ...validRequest,
      method: "GET", // changed method
      signature,
      expectedAudience: "remitflow-api",
      expectedMethod: "POST",
      expectedRoute: "/api/auth/login",
      publicKeyOrSecret: publicKeySpkiDer,
      nowMs: Date.parse("2026-07-23T00:01:00.000Z"),
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("METHOD_MISMATCH");
  });

  it("✓ route changed (/auth/login -> /auth/logout) must fail", () => {
    const payload = buildCanonicalSigningPayload(validRequest);
    const signature = signPayload(payload);

    const result = verifyCanonicalRequest({
      ...validRequest,
      route: "/api/auth/logout", // changed route
      signature,
      expectedAudience: "remitflow-api",
      expectedRoute: "/api/auth/login",
      publicKeyOrSecret: publicKeySpkiDer,
      nowMs: Date.parse("2026-07-23T00:01:00.000Z"),
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("ROUTE_MISMATCH");
  });

  it("✓ body modified must fail", () => {
    const payload = buildCanonicalSigningPayload(validRequest);
    const signature = signPayload(payload);

    const result = verifyCanonicalRequest({
      ...validRequest,
      body: { a: 1, b: 999 }, // modified body
      signature,
      expectedAudience: "remitflow-api",
      publicKeyOrSecret: publicKeySpkiDer,
      nowMs: Date.parse("2026-07-23T00:01:00.000Z"),
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("SIGNATURE_INVALID");
  });

  it("✓ audience changed must fail", () => {
    const payload = buildCanonicalSigningPayload(validRequest);
    const signature = signPayload(payload);

    const result = verifyCanonicalRequest({
      ...validRequest,
      audience: "other-api", // changed audience
      signature,
      expectedAudience: "remitflow-api",
      publicKeyOrSecret: publicKeySpkiDer,
      nowMs: Date.parse("2026-07-23T00:01:00.000Z"),
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("AUDIENCE_MISMATCH");
  });

  it("✓ nonce changed must fail", () => {
    const payload = buildCanonicalSigningPayload(validRequest);
    const signature = signPayload(payload);

    const result = verifyCanonicalRequest({
      ...validRequest,
      nonce: "nonce-tampered-999", // changed nonce
      signature,
      expectedAudience: "remitflow-api",
      publicKeyOrSecret: publicKeySpkiDer,
      nowMs: Date.parse("2026-07-23T00:01:00.000Z"),
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("SIGNATURE_INVALID");
  });

  it("✓ timestamp changed must fail", () => {
    const payload = buildCanonicalSigningPayload(validRequest);
    const signature = signPayload(payload);

    // Test expired timestamp (past 5 min limit)
    const resultExpired = verifyCanonicalRequest({
      ...validRequest,
      issuedAt: "2026-07-23T00:00:00.000Z",
      signature,
      expectedAudience: "remitflow-api",
      publicKeyOrSecret: publicKeySpkiDer,
      nowMs: Date.parse("2026-07-23T00:10:00.000Z"), // 10 minutes later
    });
    expect(resultExpired.valid).toBe(false);
    expect(resultExpired.reason).toBe("TIMESTAMP_INVALID");

    // Test tampered timestamp value against signed payload
    const resultTampered = verifyCanonicalRequest({
      ...validRequest,
      issuedAt: "2026-07-23T00:00:30.000Z", // changed issuedAt timestamp
      signature,
      expectedAudience: "remitflow-api",
      publicKeyOrSecret: publicKeySpkiDer,
      nowMs: Date.parse("2026-07-23T00:01:00.000Z"),
    });
    expect(resultTampered.valid).toBe(false);
    expect(resultTampered.reason).toBe("SIGNATURE_INVALID");
  });

  it("✓ deterministic canonicalization for equivalent JSON payloads", () => {
    const req1 = {
      ...validRequest,
      body: { a: 1, b: 2 },
    };
    const req2 = {
      ...validRequest,
      body: { b: 2, a: 1 },
    };
    const req3 = {
      ...validRequest,
      body: '{\n  "b": 2,\n  "a": 1\n}',
    };

    const payload1 = buildCanonicalSigningPayload(req1);
    const payload2 = buildCanonicalSigningPayload(req2);
    const payload3 = buildCanonicalSigningPayload(req3);

    expect(payload1).toBe(payload2);
    expect(payload1).toBe(payload3);
  });

  it("✓ parses and verifies reusable fixtures", () => {
    for (const item of fixture.fixtures) {
      if (item.expectedBodyHash && item.body !== undefined) {
        expect(computeBodyHash(item.body)).toBe(item.expectedBodyHash);
      }
      if (item.expectedRoute && item.route) {
        expect(canonicalizeRoute(item.route)).toBe(item.expectedRoute);
      }
      if (item.expectedCanonical) {
        const payload = buildCanonicalSigningPayload({
          version: item.version!,
          method: item.method!,
          route: item.route!,
          body: item.body,
          nonce: item.nonce!,
          issuedAt: item.issuedAt!,
          audience: item.audience!,
        });
        expect(payload).toBe(item.expectedCanonical);
      }
    }
  });

  it("✓ handles canonicalJson edge cases", () => {
    expect(canonicalJson({ z: { b: 1, a: 2 }, y: [3, 2, 1] })).toBe(
      '{"y":[3,2,1],"z":{"a":2,"b":1}}',
    );
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson("hello")).toBe('"hello"');
    expect(canonicalJson(42)).toBe("42");
    expect(canonicalJson(true)).toBe("true");
  });
});
