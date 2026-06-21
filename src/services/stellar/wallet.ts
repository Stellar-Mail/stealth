/**
 * Wallet authorization + signing via Freighter (@stellar/freighter-api v6).
 *
 * The canonical envelope payload is signed with the user's Stellar key
 * (Ed25519). If the user declines the wallet prompt we throw
 * WalletRejectedError so the caller can preserve the draft.
 */
import {
  isConnected as freighterIsConnected,
  requestAccess as freighterRequestAccess,
  signMessage as freighterSignMessage,
} from "@stellar/freighter-api";

export class WalletUnavailableError extends Error {
  constructor(message = "Freighter wallet was not detected") {
    super(message);
    this.name = "WalletUnavailableError";
  }
}

export class WalletRejectedError extends Error {
  constructor(message = "Wallet authorization was declined") {
    super(message);
    this.name = "WalletRejectedError";
  }
}

export interface WalletSignature {
  scheme: "Ed25519";
  signerAddress: string;
  value: string;
}

/**
 * Wallet provider seam.
 *
 * Production always talks to the real Freighter API. End-to-end tests run in a
 * headless browser with no wallet extension, so they may install a
 * deterministic stub on `globalThis.__freighterApi`. The override is only
 * consulted when explicitly set, so production behaviour is unchanged.
 */
type FreighterApi = {
  isConnected: typeof freighterIsConnected;
  requestAccess: typeof freighterRequestAccess;
  signMessage: typeof freighterSignMessage;
};

function freighter(): FreighterApi {
  const injected = (
    globalThis as unknown as {
      __freighterApi?: Partial<FreighterApi>;
    }
  ).__freighterApi;
  return {
    isConnected: injected?.isConnected ?? freighterIsConnected,
    requestAccess: injected?.requestAccess ?? freighterRequestAccess,
    signMessage: injected?.signMessage ?? freighterSignMessage,
  };
}

function describe(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  const maybe = error as { message?: unknown };
  return typeof maybe.message === "string" ? maybe.message : String(error);
}

function isUserRejection(message: string): boolean {
  return /(declin|deni|reject|cancel)/i.test(message);
}

function normalizeSignature(signed: unknown): string {
  if (typeof signed === "string") return signed;
  if (signed instanceof Uint8Array) {
    return Array.from(signed, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  const arrayLike = signed as { data?: number[] } | null;
  if (arrayLike && Array.isArray(arrayLike.data)) {
    return arrayLike.data.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return String(signed ?? "");
}

/**
 * Ask the wallet to authorize and sign the canonical envelope payload.
 *
 * Throws WalletUnavailableError if Freighter is not installed/connected, and
 * WalletRejectedError if the user declines. The pipeline relies on the
 * rejection error to keep the draft intact.
 */
export async function authorizeSend(canonicalPayload: string): Promise<WalletSignature> {
  const wallet = freighter();

  const connection = (await wallet.isConnected()) as {
    isConnected?: boolean;
    error?: unknown;
  };
  if (!connection?.isConnected) {
    throw new WalletUnavailableError();
  }

  const access = (await wallet.requestAccess()) as {
    address?: string;
    error?: unknown;
  };
  const accessError = describe(access?.error);
  if (accessError) {
    if (isUserRejection(accessError)) {
      throw new WalletRejectedError(accessError);
    }
    throw new WalletUnavailableError(accessError);
  }

  const signed = (await wallet.signMessage(canonicalPayload)) as {
    signedMessage?: unknown;
    signerAddress?: string;
    error?: unknown;
  };
  const signError = describe(signed?.error);
  if (signError) {
    if (isUserRejection(signError)) {
      throw new WalletRejectedError(signError);
    }
    throw new Error("Wallet failed to sign the message");
  }

  return {
    scheme: "Ed25519",
    signerAddress: signed?.signerAddress ?? access?.address ?? "",
    value: normalizeSignature(signed?.signedMessage),
  };
}
