/**
 * Wallet authorization + signing via Freighter (@stellar/freighter-api v6).
 *
 * The canonical envelope payload is signed with the user's Stellar key
 * (Ed25519). If the user declines the wallet prompt we throw
 * WalletRejectedError so the caller can preserve the draft.
 *
 * The import is intentionally dynamic so that the Freighter bundle is excluded
 * from the initial SSR/client chunk and only loaded on first wallet call.
 */
let _freighterPkg: typeof import("@stellar/freighter-api") | null = null;
async function loadFreighter() {
  if (!_freighterPkg) {
    const mod = await import("@stellar/freighter-api");
    _freighterPkg = (mod.default ?? mod) as typeof import("@stellar/freighter-api");
  }
  return _freighterPkg;
}

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
 * Resolve the address the wallet will sign with (i.e. the sender for a new
 * message). Reads the same provider seam as `authorizeSend`, so e2e stubs and
 * production agree on the signer identity. Returns `null` when no wallet is
 * connected so the caller can fall back to a draft value.
 */
export async function resolveSenderAddress(): Promise<string | null> {
  const wallet = await freighter();
  try {
    const connection = (await wallet.isConnected()) as {
      isConnected?: boolean;
      error?: unknown;
    };
    if (!connection?.isConnected) return null;
    const access = (await wallet.requestAccess()) as {
      address?: string;
      error?: unknown;
    };
    if (access?.error || !access?.address) return null;
    return access.address;
  } catch {
    return null;
  }
}

/**
 * Wallet provider seam.
 *
 * Production always talks to the real Freighter API. End-to-end tests run in a
 * headless browser with no wallet extension, so they may install a
 * deterministic stub on `globalThis.__freighterApi`. The override is only
 * consulted when explicitly set, so production behaviour is unchanged.
 */
// Extract the precise function types directly from the package declaration so the
// local FreighterApi seam stays in sync with the library without re-stating signatures.
type FreighterPkg = typeof import("@stellar/freighter-api");
type FreighterApi = {
  isConnected: FreighterPkg["isConnected"];
  requestAccess: FreighterPkg["requestAccess"];
  signMessage: FreighterPkg["signMessage"];
};

async function freighter(): Promise<FreighterApi> {
  const injected = (
    globalThis as unknown as {
      __freighterApi?: Partial<FreighterApi>;
    }
  ).__freighterApi;

  const pkg = await loadFreighter();
  return {
    isConnected: injected?.isConnected ?? pkg.isConnected,
    requestAccess: injected?.requestAccess ?? pkg.requestAccess,
    signMessage: injected?.signMessage ?? pkg.signMessage,
  };
}

export async function getFreighterApi(): Promise<FreighterApi> {
  return freighter();
}

export async function isFreighterConnected(): Promise<boolean> {
  try {
    const wallet = await freighter();
    const connection = (await wallet.isConnected()) as {
      isConnected?: boolean;
      error?: unknown;
    };
    return Boolean(connection?.isConnected);
  } catch {
    return false;
  }
}

export async function getFreighterNetwork(): Promise<string | null> {
  try {
    const pkg = await loadFreighter();
    if (typeof (pkg as any).getNetworkDetails === "function") {
      const details = await (pkg as any).getNetworkDetails();
      return details?.networkPassphrase ?? details?.network ?? null;
    }
    if (typeof (pkg as any).getNetwork === "function") {
      const network = await (pkg as any).getNetwork();
      return typeof network === "string" ? network : (network?.networkPassphrase ?? null);
    }
    return null;
  } catch {
    return null;
  }
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
  const wallet = await freighter();

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
