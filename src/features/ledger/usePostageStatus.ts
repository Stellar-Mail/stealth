import { useQuery } from "@tanstack/react-query";
import { sharedTypedApi as api, queryKeys } from "@/lib/api";
import type { PostageRecord } from "@/lib/api";

export type PostageStatusUiState =
  | { status: "loading" }
  | { status: "ready"; data: PostageRecord }
  | { status: "not_found" }
  | { status: "error"; message: string };

export function usePostageStatus(messageId?: string) {
  const query = useQuery({
    queryKey: queryKeys.postage.byMessage(messageId!),
    queryFn: async ({ signal }) => {
      try {
        return await api.postage.get(messageId!, signal);
      } catch (err: any) {
        if (err.status === 404) {
          return null; // Return null to indicate not found
        }
        throw err;
      }
    },
    enabled: !!messageId,
    staleTime: 15_000,
    refetchInterval: (query) => {
      // Don't poll terminal states
      if (
        query.state.data &&
        (query.state.data.status === "settled" ||
          query.state.data.status === "refunded" ||
          query.state.data.status === "reclaimed")
      ) {
        return false;
      }
      return 15_000;
    },
  });

  let uiState: PostageStatusUiState;
  if (query.isLoading && !query.data) {
    uiState = { status: "loading" };
  } else if (query.isError) {
    uiState = { status: "error", message: query.error?.message || "Failed to load postage status" };
  } else if (query.data === null) {
    uiState = { status: "not_found" };
  } else if (query.data) {
    uiState = { status: "ready", data: query.data };
  } else {
    uiState = { status: "loading" };
  }

  return { ...query, uiState };
}
