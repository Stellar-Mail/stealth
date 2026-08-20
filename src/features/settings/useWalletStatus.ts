import { useQuery } from "@tanstack/react-query";

import { sharedTypedApi as api, queryKeys } from "@/lib/api";
import type { PublicWalletStatus } from "@/lib/api";

export type WalletStatusUiKind =
  "loading" | "active" | "pending" | "stale" | "unavailable" | "failed";

export type WalletStatusUiState =
  | { kind: "loading" }
  | { kind: "active"; status: PublicWalletStatus }
  | { kind: "pending"; status: PublicWalletStatus }
  | { kind: "stale"; status: PublicWalletStatus }
  | { kind: "unavailable"; status?: PublicWalletStatus }
  | { kind: "failed"; status: PublicWalletStatus };

export function resolveWalletStatusUiState(input: {
  isLoading: boolean;
  isError: boolean;
  status?: PublicWalletStatus;
}): WalletStatusUiState {
  if (input.isLoading && !input.status) {
    return { kind: "loading" };
  }
  if (input.isError && !input.status) {
    return { kind: "unavailable" };
  }
  if (!input.status) {
    return { kind: "unavailable" };
  }
  if (input.status.freshness === "unavailable") {
    return { kind: "unavailable", status: input.status };
  }
  if (input.status.activation === "pending") {
    return { kind: "pending", status: input.status };
  }
  if (input.status.freshness === "stale" || input.status.stale) {
    return { kind: "stale", status: input.status };
  }
  if (input.status.activation === "failed") {
    return { kind: "failed", status: input.status };
  }
  return { kind: "active", status: input.status };
}

export function useWalletStatus(options: { enabled?: boolean } = {}) {
  const query = useQuery({
    queryKey: queryKeys.wallet.status,
    queryFn: ({ signal }) => api.wallet.getStatus(undefined, signal),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });

  return {
    ...query,
    ui: resolveWalletStatusUiState({
      isLoading: query.isLoading,
      isError: query.isError,
      status: query.data,
    }),
  };
}
