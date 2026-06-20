import { useState, useCallback, useEffect } from "react";
import { useFreighter, type FreighterState } from "../onboarding/useFreighter";

export type StellarNetwork = "mainnet" | "testnet";

export type WalletState = {
  freighter: FreighterState;
  network: StellarNetwork;
  actorAddress: string | null;
  isReadyForSigning: boolean;
};

export type WalletMismatch = {
  type: "network" | "account";
  message: string;
  recovery: string;
};

export type WalletHook = WalletState & {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (network: StellarNetwork) => void;
  setActorAddress: (address: string | null) => void;
  mismatch: WalletMismatch | null;
};

const NETWORK_KEY = "stealth-network-v1";

function loadNetwork(): StellarNetwork {
  if (typeof window === "undefined") return "testnet";
  const saved = window.localStorage.getItem(NETWORK_KEY);
  if (saved === "mainnet" || saved === "testnet") return saved;
  return "testnet";
}

export function useWallet(options?: { actorAddress?: string | null }): WalletHook {
  const freighter = useFreighter();
  const [network, setNetwork] = useState<StellarNetwork>(loadNetwork);
  const [actorAddress, setActorAddress] = useState<string | null>(options?.actorAddress ?? null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NETWORK_KEY, network);
    }
  }, [network]);

  useEffect(() => {
    if (options?.actorAddress !== undefined) {
      setActorAddress(options.actorAddress);
    }
  }, [options?.actorAddress]);

  const connect = useCallback(async () => {
    await freighter.connect();
  }, [freighter]);

  const handleDisconnect = useCallback(() => {
    freighter.disconnect();
    setActorAddress(null);
  }, [freighter]);

  const switchNetwork = useCallback((newNetwork: StellarNetwork) => {
    setNetwork(newNetwork);
  }, []);

  const walletAddress = freighter.state.status === "connected" ? freighter.state.address : null;

  const mismatch: WalletMismatch | null = (() => {
    if (freighter.state.status !== "connected" || !walletAddress) {
      return null;
    }

    if (actorAddress && actorAddress !== walletAddress) {
      return {
        type: "account",
        message: "Connected wallet differs from active mailbox",
        recovery: "Switch to the correct wallet account or select the matching mailbox.",
      };
    }

    return null;
  })();

  const isReadyForSigning = freighter.state.status === "connected" && !mismatch;

  return {
    freighter: freighter.state,
    network,
    actorAddress,
    isReadyForSigning,
    connect,
    disconnect: handleDisconnect,
    switchNetwork,
    setActorAddress: (address: string | null) => setActorAddress(address),
    mismatch,
  };
}