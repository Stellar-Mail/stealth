/**
 * useStellarAccount Hook
 *
 * Manages local Stellar account state (public key + fetched account details).
 * Queries Horizon directly. No dependency on the main app's Stellar integration.
 */

import { useState, useCallback } from "react";
import type { StellarAccount } from "../types";
import { stellarService } from "../services";

interface UseStellarAccountResult {
  account: StellarAccount | null;
  publicKey: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connect: (publicKey: string) => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
}

export function useStellarAccount(): UseStellarAccountResult {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [account, setAccount] = useState<StellarAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = useCallback(async (key: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await stellarService.getAccount(key);
      setAccount(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load account";
      setError(message);
      setAccount(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connect = useCallback(
    async (key: string) => {
      if (!stellarService.isValidAccountId(key)) {
        setError("Invalid Stellar account ID");
        return;
      }
      setPublicKey(key);
      await fetchAccount(key);
    },
    [fetchAccount],
  );

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setAccount(null);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (publicKey) await fetchAccount(publicKey);
  }, [publicKey, fetchAccount]);

  return {
    account,
    publicKey,
    isConnected: account !== null,
    isLoading,
    error,
    connect,
    disconnect,
    refresh,
  };
}
