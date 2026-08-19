import type {
  ActiveSigner,
  ExternalWallet,
  ManagedWalletStatus,
  WalletCapability,
} from "@/server/api/domain";

export class WalletLinkError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "WalletLinkError";
  }
}

export class WrongNetworkError extends WalletLinkError {
  constructor(message = "Connected wallet is on a different network from the target network") {
    super(message, "wrong_network", 400);
    this.name = "WrongNetworkError";
  }
}

export class WalletNotInstalledError extends WalletLinkError {
  constructor(
    message = "Freighter extension was not detected. Please install Freighter from freighter.app or enable it.",
  ) {
    super(message, "wallet_not_installed", 400);
    this.name = "WalletNotInstalledError";
  }
}

export class WalletRejectedError extends WalletLinkError {
  constructor(message = "Wallet request was declined by user") {
    super(message, "wallet_rejected", 400);
    this.name = "WalletRejectedError";
  }
}

export async function getManagedWalletStatus(): Promise<ManagedWalletStatus> {
  const response = await fetch("/api/v1/wallet/managed");
  const body = await response.json();
  if (!response.ok) {
    throw new WalletLinkError(
      body.error?.message ?? "Failed to fetch managed wallet status",
      body.error?.code,
      response.status,
    );
  }
  return body.data;
}

export async function requestChallenge(
  externalAddress: string,
  network: string,
): Promise<{ challenge: string; expiresAt: string }> {
  const response = await fetch("/api/v1/wallet/link/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: externalAddress, network }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new WalletLinkError(
      body.error?.message ?? "Failed to create challenge",
      body.error?.code,
      response.status,
    );
  }
  return body.data;
}

export async function verifyAndLink(
  externalAddress: string,
  signature: string,
  capabilities: WalletCapability[],
  network: string,
): Promise<ExternalWallet> {
  const response = await fetch("/api/v1/wallet/link/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: externalAddress,
      signature,
      capabilities,
      network,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new WalletLinkError(
      body.error?.message ?? "Failed to verify and link wallet",
      body.error?.code,
      response.status,
    );
  }
  return body.data;
}

export async function listLinkedWallets(): Promise<ExternalWallet[]> {
  const response = await fetch("/api/v1/wallet/link");
  const body = await response.json();
  if (!response.ok) {
    throw new WalletLinkError(
      body.error?.message ?? "Failed to list linked wallets",
      body.error?.code,
      response.status,
    );
  }
  return body.data.wallets;
}

export async function updateWalletCapabilities(
  address: string,
  capabilities: WalletCapability[],
): Promise<{ wallet: ExternalWallet; activeSigner: ActiveSigner }> {
  const response = await fetch(`/api/v1/wallet/link/${encodeURIComponent(address)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ capabilities }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new WalletLinkError(
      body.error?.message ?? "Failed to update wallet capabilities",
      body.error?.code,
      response.status,
    );
  }
  return body.data;
}

export async function unlinkWallet(
  address: string,
  options?: { confirm?: boolean },
): Promise<{ unlinked: boolean; activeSigner: ActiveSigner }> {
  const confirm = options?.confirm ?? true;
  const response = await fetch(
    `/api/v1/wallet/link/${encodeURIComponent(address)}?confirm=${confirm}`,
    {
      method: "DELETE",
      headers: {
        "x-stealth-confirm": String(confirm),
      },
    },
  );

  const body = await response.json();
  if (!response.ok) {
    throw new WalletLinkError(
      body.error?.message ?? "Failed to unlink wallet",
      body.error?.code,
      response.status,
    );
  }
  return body.data;
}
