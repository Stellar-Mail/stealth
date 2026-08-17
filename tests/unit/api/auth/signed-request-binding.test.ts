import { generateKeyPairSync, sign, verify } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import {
  canonicalizeSignedRequest,
  validateSignedRequestAudience,
  type SignedRequestInput,
} from "../../../../src/server/api/auth/signed-request";

/**
 * Issue #1462: a signed request's canonical form must bind the signature to
 * the exact method, route, body, and audience it was issued for. These tests
 * exercise real Ed25519 signing/verification (not just string comparison) so
 * a regression that accidentally drops a field from the canonical string --
 * and would therefore let a signature move to a different operation -- fails
 * here even if the two canonical strings happen to differ in some other way.
 */

const BASE: SignedRequestInput = {
  version: "STEALTH-AUTH-V1",
  method: "POST",
  url: "https://api.example.test/api/v1/messages?limit=10&cursor=alpha",
  headers: {
    host: "api.example.test",
    "x-stealth-address": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    "x-stealth-nonce": "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    "x-stealth-timestamp": "2026-07-22T12:00:00.000Z",
    "x-stealth-audience": "stealth-api.example.test",
  },
  body: '{"recipient":"GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBUJD"}',
};

let publicKey: ReturnType<typeof generateKeyPairSync>["publicKey"];
let privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"];

beforeAll(() => {
  ({ publicKey, privateKey } = generateKeyPairSync("ed25519"));
});

function signRequest(input: SignedRequestInput): string {
  return sign(null, Buffer.from(canonicalizeSignedRequest(input)), privateKey).toString("base64");
}

/** Verifies `signature` (captured for `signedFor`) against `presentedAs`. */
function verifiesAgainst(signature: string, presentedAs: SignedRequestInput): boolean {
  return verify(
    null,
    Buffer.from(canonicalizeSignedRequest(presentedAs)),
    publicKey,
    Buffer.from(signature, "base64"),
  );
}

describe("signed request cross-operation substitution", () => {
  it("binds the signature to its exact request end to end", () => {
    const signature = signRequest(BASE);
    expect(verifiesAgainst(signature, BASE)).toBe(true);
  });

  it("a signature for one HTTP method cannot authorize another", () => {
    const signature = signRequest(BASE);
    const asGet = { ...BASE, method: "GET" };
    const asDelete = { ...BASE, method: "DELETE" };

    expect(canonicalizeSignedRequest(asGet)).not.toBe(canonicalizeSignedRequest(BASE));
    expect(verifiesAgainst(signature, asGet)).toBe(false);
    expect(verifiesAgainst(signature, asDelete)).toBe(false);
  });

  it("a signature for one route cannot authorize another", () => {
    const signature = signRequest(BASE);
    const otherPath = {
      ...BASE,
      url: "https://api.example.test/api/v1/messages/other-resource?limit=10&cursor=alpha",
    };
    const otherOwner = {
      ...BASE,
      url: "https://api.example.test/api/v1/policies/GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBUJD",
    };

    expect(canonicalizeSignedRequest(otherPath)).not.toBe(canonicalizeSignedRequest(BASE));
    expect(verifiesAgainst(signature, otherPath)).toBe(false);
    expect(verifiesAgainst(signature, otherOwner)).toBe(false);
  });

  it("changing the query string invalidates the signature", () => {
    const signature = signRequest(BASE);
    const otherQuery = {
      ...BASE,
      url: "https://api.example.test/api/v1/messages?limit=10&cursor=omega",
    };

    expect(canonicalizeSignedRequest(otherQuery)).not.toBe(canonicalizeSignedRequest(BASE));
    expect(verifiesAgainst(signature, otherQuery)).toBe(false);
  });

  it("changing the body invalidates the signature", () => {
    const signature = signRequest(BASE);
    const otherBody = {
      ...BASE,
      body: '{"recipient":"GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCUJD"}',
    };
    const emptyBody = { ...BASE, body: "" };

    expect(canonicalizeSignedRequest(otherBody)).not.toBe(canonicalizeSignedRequest(BASE));
    expect(verifiesAgainst(signature, otherBody)).toBe(false);
    expect(verifiesAgainst(signature, emptyBody)).toBe(false);
  });

  it("a signature scoped to one audience cannot authorize another deployment", () => {
    const signature = signRequest(BASE);
    const otherAudience = {
      ...BASE,
      headers: { ...BASE.headers, "x-stealth-audience": "stealth-api.staging.test" },
    };

    expect(canonicalizeSignedRequest(otherAudience)).not.toBe(canonicalizeSignedRequest(BASE));
    expect(verifiesAgainst(signature, otherAudience)).toBe(false);
  });

  it("swapping the nonce or timestamp of a different signed request invalidates it", () => {
    const signature = signRequest(BASE);
    const otherNonce = {
      ...BASE,
      headers: {
        ...BASE.headers,
        "x-stealth-nonce": "ff112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
      },
    };
    const otherTimestamp = {
      ...BASE,
      headers: { ...BASE.headers, "x-stealth-timestamp": "2026-07-22T12:05:00.000Z" },
    };

    expect(verifiesAgainst(signature, otherNonce)).toBe(false);
    expect(verifiesAgainst(signature, otherTimestamp)).toBe(false);
  });
});

describe("signed request canonicalization determinism", () => {
  it("is identical for equivalent requests with reordered query parameters", () => {
    const reordered = {
      ...BASE,
      url: "https://api.example.test/api/v1/messages?cursor=alpha&limit=10",
    };
    expect(canonicalizeSignedRequest(reordered)).toBe(canonicalizeSignedRequest(BASE));
  });

  it("is identical for equivalent requests with header casing and whitespace differences", () => {
    const messyHeaders = {
      ...BASE,
      method: "post",
      headers: {
        Host: "  api.example.test  ",
        "X-Stealth-Address": BASE.headers["x-stealth-address"],
        "X-STEALTH-NONCE": BASE.headers["x-stealth-nonce"],
        "x-stealth-timestamp": BASE.headers["x-stealth-timestamp"],
        "X-Stealth-Audience": `  ${BASE.headers["x-stealth-audience"]}  `,
      },
    };
    expect(canonicalizeSignedRequest(messyHeaders)).toBe(canonicalizeSignedRequest(BASE));
  });

  it("produces a signature that verifies identically across equivalent request shapes", () => {
    const signature = signRequest(BASE);
    const reordered = {
      ...BASE,
      url: "https://api.example.test/api/v1/messages?cursor=alpha&limit=10",
    };
    expect(verifiesAgainst(signature, reordered)).toBe(true);
  });
});

describe("validateSignedRequestAudience", () => {
  it("accepts an audience present in the active set", () => {
    expect(() =>
      validateSignedRequestAudience("stealth-api.example.test", {
        activeAudiences: new Set(["stealth-api.example.test"]),
      }),
    ).not.toThrow();
  });

  it("accepts any audience within a multi-value rotation window", () => {
    const config = {
      activeAudiences: new Set(["stealth-api.example.test", "stealth-api.example.test.v2"]),
    };
    expect(() => validateSignedRequestAudience("stealth-api.example.test", config)).not.toThrow();
    expect(() =>
      validateSignedRequestAudience("stealth-api.example.test.v2", config),
    ).not.toThrow();
  });

  it("rejects an audience outside the accepted set", () => {
    expect(() =>
      validateSignedRequestAudience("stealth-api.staging.test", {
        activeAudiences: new Set(["stealth-api.example.test"]),
      }),
    ).toThrow();
  });

  it("rejects an empty audience", () => {
    expect(() =>
      validateSignedRequestAudience("", { activeAudiences: new Set(["stealth-api.example.test"]) }),
    ).toThrow();
  });
});
