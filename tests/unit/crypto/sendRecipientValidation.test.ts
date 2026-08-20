/**
 * Send-path recipient key domain rules (BETA-046 / #1953). Verifies the
 * validation boundary rejects revoked / expired / not-yet-valid / unbound /
 * unsupported / unresolved identity material with stable non-secret codes,
 * and accepts only current, valid P-256 ECDH SPKI keys.
 */
import { describe, expect, it } from "vitest";
import {
  recipientKeyToMaterial,
  classifyResolverFailure,
  RecipientKeyRejectedError,
  type RecipientKeyMaterial,
} from "../../../src/services/crypto/sendRecipientValidation";
import { generateRecipientKeyPair } from "../../../src/services/crypto/key-wrap";
import { ResolverError, type ResolvedKey } from "../../../src/services/crypto/key-resolver";

function makeResolved(overrides: Partial<ResolvedKey> = {}): ResolvedKey {
  return {
    recipient: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    publicKey: new Uint8Array([1, 2, 3, 4]),
    keyId: "k1",
    notBefore: "2020-01-01T00:00:00Z",
    notAfter: "2099-01-01T00:00:00Z",
    revoked: false,
    provenance: "trusted-directory",
    ...overrides,
  };
}

async function validResolved(): Promise<ResolvedKey> {
  const { publicKeySpkiBase64 } = await generateRecipientKeyPair();
  return makeResolved({
    publicKey: Uint8Array.from(atob(publicKeySpkiBase64), (c) => c.charCodeAt(0)),
  });
}

describe("sendRecipientValidation (#1953)", () => {
  it("accepts a current, valid P-256 key bound to the recipient", async () => {
    const resolved = await validResolved();
    const material: RecipientKeyMaterial = await recipientKeyToMaterial(
      resolved,
      resolved.recipient,
    );
    expect(material.account).toBe(resolved.recipient);
    expect(material.keyId).toBe("k1");
    expect(material.publicKeySpkiBase64.length).toBeGreaterThan(0);
  });

  it("rejects a key bound to a different recipient as wrong_network", async () => {
    const resolved = await validResolved();
    await expect(
      recipientKeyToMaterial(resolved, "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"),
    ).rejects.toMatchObject({ code: "wrong_network" });
  });

  it("rejects revoked keys", async () => {
    const resolved = await validResolved();
    await expect(
      recipientKeyToMaterial({ ...resolved, revoked: true }, resolved.recipient),
    ).rejects.toMatchObject({ code: "revoked" });
  });

  it("rejects keys with no public material as unresolved", async () => {
    const resolved = makeResolved({ publicKey: new Uint8Array(0) });
    await expect(recipientKeyToMaterial(resolved, resolved.recipient)).rejects.toMatchObject({
      code: "unresolved",
    });
  });

  it("rejects non-P-256 material (ed25519 signing key) as unsupported_algorithm", async () => {
    const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const resolved = makeResolved({
      publicKey: new Uint8Array(spki),
    });
    await expect(recipientKeyToMaterial(resolved, resolved.recipient)).rejects.toMatchObject({
      code: "unsupported_algorithm",
    });
  });

  it("classifies resolver failures into stable codes", () => {
    const recipient = "GABC";
    const cases: Array<[string, string]> = [
      ["resolved key has been revoked", "revoked"],
      ["resolved key is not yet valid", "not_yet_valid"],
      ["resolved key has expired", "expired"],
      ["resolved key is not bound to the requested recipient", "wrong_network"],
      ["resolved key has no public key material", "unresolved"],
    ];
    for (const [message, expected] of cases) {
      const error = classifyResolverFailure(recipient, new ResolverError(message));
      expect(error).toBeInstanceOf(RecipientKeyRejectedError);
      expect(error.code).toBe(expected);
    }
  });

  it("passes through an already-classified rejection", () => {
    const rejection = new RecipientKeyRejectedError("GABC", "revoked", "revoked");
    expect(classifyResolverFailure("GABC", rejection)).toBe(rejection);
  });
});
