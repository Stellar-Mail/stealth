import { beforeEach, describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

import {
  authenticateSignedRequest,
  buildSignedRequestHeaders,
  isHeaderOnlyAuthAllowed,
  resetSignedRequestNonceStore,
  SIGNATURE_HEADER,
} from "../../../../src/server/api/auth/signed-request-verify";
import { ApiError } from "../../../../src/server/api/errors";

describe("STEALTH-AUTH-V1 authenticateSignedRequest", () => {
  const keypair = Keypair.random();

  beforeEach(() => {
    resetSignedRequestNonceStore();
  });

  it("disables header-only auth in production or when require-signed is set", () => {
    expect(
      isHeaderOnlyAuthAllowed({
        STEALTH_AUTH_ALLOW_HEADER_ONLY: "1",
        STEALTH_AUTH_REQUIRE_SIGNED: "1",
      }),
    ).toBe(false);
  });

  it("authenticates a correctly signed request", async () => {
    const url = "https://stealth.test/api/v1/policies/demo";
    const body = '{"ok":true}';
    const headers = buildSignedRequestHeaders({
      keypair,
      method: "POST",
      url,
      body,
      audience: "stealth.test",
    });

    const principal = await authenticateSignedRequest(
      new Request(url, { method: "POST", headers, body }),
    );
    expect(principal.address).toBe(keypair.publicKey());
    expect(principal.authMethod).toBe("signed-request");
  });

  it("rejects nonce replay", async () => {
    const url = "https://stealth.test/api/v1/policies/demo";
    const body = '{"ok":true}';
    const headers = buildSignedRequestHeaders({
      keypair,
      method: "POST",
      url,
      body,
      audience: "stealth.test",
      nonce: "aa".repeat(32),
    });

    await authenticateSignedRequest(new Request(url, { method: "POST", headers, body }));
    await expect(
      authenticateSignedRequest(new Request(url, { method: "POST", headers, body })),
    ).rejects.toMatchObject({ status: 409, code: "conflict" } satisfies Partial<ApiError>);
  });

  it("rejects a missing signature", async () => {
    const url = "https://stealth.test/api/v1/policies/demo";
    const body = '{"ok":true}';
    const headers = buildSignedRequestHeaders({
      keypair,
      method: "POST",
      url,
      body,
      audience: "stealth.test",
    });
    delete (headers as Record<string, string | undefined>)[SIGNATURE_HEADER];

    await expect(
      authenticateSignedRequest(new Request(url, { method: "POST", headers, body })),
    ).rejects.toMatchObject({ status: 401, code: "unauthorized" });
  });
});
