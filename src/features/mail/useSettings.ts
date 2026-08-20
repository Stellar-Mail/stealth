// ---------------------------------------------------------------------------
// BETA-051 (Issue #1958) — typed mailbox settings hook.
// ---------------------------------------------------------------------------

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { sharedTypedApi as api, queryKeys, cacheInvalidations } from "@/lib/api";
import type { MailboxSettings, MailboxPolicyWrite } from "@/lib/api";

/** Reads mailbox settings (policy surface) through the typed settings client. */
export function useMailboxSettings(owner: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: ({ signal }) => api.settings.read(owner ?? "", signal),
    enabled: Boolean(owner) && enabled,
  });
}

/** Persists mailbox settings changes and invalidates dependent caches. */
export function useUpdateMailboxSettings(owner: string | null) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, MailboxPolicyWrite>({
    mutationFn: (policy) => api.settings.update(owner ?? "", policy),
    onSuccess: async () => {
      for (const key of cacheInvalidations.updateMailboxPolicy(owner ?? "anonymous")) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export type { MailboxSettings };
