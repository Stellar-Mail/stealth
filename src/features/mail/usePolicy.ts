// ---------------------------------------------------------------------------
// BETA-051 (Issue #1958) — typed mailbox policy hook.
// ---------------------------------------------------------------------------

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { sharedTypedApi as api, queryKeys, cacheInvalidations } from "@/lib/api";
import type { MailboxPolicy, MailboxPolicyWrite } from "@/lib/api";

/** Reads the mailbox policy for an owner through the typed policies client. */
export function useMailboxPolicy(owner: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.policies.policy(owner ?? "anonymous"),
    queryFn: ({ signal }) => api.policies.get(owner ?? "", signal),
    enabled: Boolean(owner) && enabled,
  });
}

/** Updates the mailbox policy and invalidates policy + settings caches. */
export function useUpdateMailboxPolicy(owner: string | null) {
  const queryClient = useQueryClient();

  return useMutation<MailboxPolicy, Error, MailboxPolicyWrite>({
    mutationFn: (policy) => api.policies.update(owner ?? "", policy),
    onSuccess: async () => {
      for (const key of cacheInvalidations.updateMailboxPolicy(owner ?? "anonymous")) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
