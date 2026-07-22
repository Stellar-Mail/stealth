import { readFileSync } from "node:fs";
import { verify } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  canonicalizeSignedRequest,
  signedRequestTimeStatus,
  type SignedRequestInput,
} from "../../../../src/server/api/auth/signed-request";

interface Vector {
  name: string;
  request: SignedRequestInput & { signature: string };
  expected: { canonical: string; outcome: string; error?: string };
  replayOf?: string;
}

interface Fixture {
  version: string;
  now: string;
  publicKeySpkiDerBase64: string;
  vectors: Vector[];
}

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../../test-fixtures/auth/signed-request-v1.json", import.meta.url),
    "utf8",
  ),
) as Fixture;

function signatureIsValid(vector: Vector): boolean {
  return verify(
    null,
    Buffer.from(canonicalizeSignedRequest(vector.request)),
    { key: Buffer.from(fixture.publicKeySpkiDerBase64, "base64"), format: "der", type: "spki" },
    Buffer.from(vector.request.signature, "base64"),
  );
}

describe("signed request v1 documentation vectors", () => {
  it("uses the supported version and contains only explicitly synthetic material", () => {
    expect(fixture.version).toBe("STEALTH-AUTH-V1");
    expect(JSON.stringify(fixture)).not.toMatch(/S[A-Z2-7]{55}/);
  });

  it.each(fixture.vectors)("executes $name", (vector) => {
    expect(canonicalizeSignedRequest(vector.request)).toBe(vector.expected.canonical);
    const time = signedRequestTimeStatus(
      vector.request.headers["x-stealth-timestamp"],
      Date.parse(fixture.now),
    );

    if (vector.expected.outcome === "accepted" || vector.expected.error === "replayed_nonce") {
      expect(time).toBe("valid");
      expect(signatureIsValid(vector)).toBe(true);
    } else if (vector.expected.error === "invalid_signature") {
      expect(signatureIsValid(vector)).toBe(false);
    } else {
      expect(time).toBe(vector.expected.error);
    }
  });

  it("models nonce consumption so a second valid request is rejected as replay", () => {
    const consumed = new Set<string>();
    for (const vector of fixture.vectors.filter((entry) => entry.name.includes("replay"))) {
      const nonce = vector.request.headers["x-stealth-nonce"];
      const replayed = consumed.has(nonce);
      if (!replayed) consumed.add(nonce);
      expect(replayed).toBe(vector.expected.error === "replayed_nonce");
    }
  });
});
