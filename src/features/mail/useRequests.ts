// ---------------------------------------------------------------------------
// BETA-051 (Issue #1958) — typed sender-request hooks.
// ---------------------------------------------------------------------------

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { sharedTypedApi as api, queryKeys, cacheInvalidations } from "@/lib/api";
import type { UnknownSenderDecision, UnknownSenderRequest } from "@/lib/api";

/**
 * Reads the pending unknown-sender requests awaiting the actor's decision,
 * through the typed requests client.
 */
export function useRequests(actor: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.requests.list(actor ?? "anonymous"),
    queryFn: ({ signal }) => api.requests.list(signal),
    enabled: Boolean(actor) && enabled,
  });
}

/** Decides a pending sender request and invalidates dependent queries. */
export function useSenderRequestDecision(actor: string | null) {
  const queryClient = useQueryClient();

  return useMutation<
    UnknownSenderRequest,
    Error,
    { requestId: string; decision: UnknownSenderDecision }
  >({
    mutationFn: ({ requestId, decision }) => api.requests.decide(requestId, decision),
    onSuccess: async () => {
      for (const key of cacheInvalidations.senderRequestDecision(actor ?? "anonymous")) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
