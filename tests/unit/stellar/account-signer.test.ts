import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AccountSigningError,
  AUTHORIZE_PATH,
  authorizeSendWithAccount,
  resolveAccountSenderAddress,
} from "@/services/stellar/account-signer";

const signature = {
  scheme: "Ed25519",
  signerAddress: `G${"A".repeat(55)}`,
  value: "ab".repeat(64),
};

afterEach(() => vi.unstubAllGlobals());

describe("Account signer client", () => {
  it("posts the canonical payload with the same-origin session cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: signature }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await authorizeSendWithAccount("canonical-envelope")).toEqual(signature);
    expect(fetchMock).toHaveBeenCalledWith(AUTHORIZE_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ canonical: "canonical-envelope" }),
    });
  });

  it.each([
    { ...signature, scheme: "unknown" },
    { ...signature, signerAddress: "not-an-address" },
    { ...signature, value: "short" },
    null,
  ])("rejects malformed signatures: %j", async (data) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data })));
    await expect(authorizeSendWithAccount("canonical-envelope")).rejects.toBeInstanceOf(
      AccountSigningError,
    );
  });

  it("surfaces the account error on an unauthorized response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: { message: "Sign in to stamp your mail" } }, { status: 401 }),
        ),
    );
    await expect(authorizeSendWithAccount("canonical-envelope")).rejects.toThrow(
      "Sign in to stamp your mail",
    );
  });

  it("turns network failures into account signing errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network unavailable")));
    await expect(authorizeSendWithAccount("canonical-envelope")).rejects.toBeInstanceOf(
      AccountSigningError,
    );
    expect(await resolveAccountSenderAddress()).toBeNull();
  });

  it("loads only the public signing address with the session cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: signature }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await resolveAccountSenderAddress()).toBe(signature.signerAddress);
    expect(fetchMock).toHaveBeenCalledWith(AUTHORIZE_PATH, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
  });

  it("returns no address for an unauthenticated or malformed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({}, { status: 401 }))
        .mockResolvedValueOnce(Response.json({ data: { signerAddress: "invalid" } })),
    );
    expect(await resolveAccountSenderAddress()).toBeNull();
    expect(await resolveAccountSenderAddress()).toBeNull();
  });
});
