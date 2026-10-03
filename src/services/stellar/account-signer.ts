import type { WalletSignature } from "./wallet";

export const AUTHORIZE_PATH = "/api/v1/envelopes/authorize";

export class AccountSigningError extends Error {
  constructor(message = "Your account could not stamp this message. Please sign in and retry.") {
    super(message);
    this.name = "AccountSigningError";
  }
}

export async function authorizeSendWithAccount(canonicalPayload: string): Promise<WalletSignature> {
  try {
    const response = await fetch(AUTHORIZE_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ canonical: canonicalPayload }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new AccountSigningError(payload.error?.message);
    }
    const signature = payload.data;
    if (
      signature?.scheme !== "Ed25519" ||
      typeof signature.signerAddress !== "string" ||
      !/^G[A-Z2-7]{55}$/.test(signature.signerAddress) ||
      typeof signature.value !== "string" ||
      !/^[a-f0-9]{128}$/i.test(signature.value)
    ) {
      throw new AccountSigningError("Your account returned an invalid mail stamp.");
    }
    return signature;
  } catch (error) {
    if (error instanceof AccountSigningError) throw error;
    throw new AccountSigningError();
  }
}

export async function resolveAccountSenderAddress(): Promise<string | null> {
  try {
    const response = await fetch(AUTHORIZE_PATH, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const address = payload.data?.signerAddress;
    return typeof address === "string" && /^G[A-Z2-7]{55}$/.test(address) ? address : null;
  } catch {
    return null;
  }
}
