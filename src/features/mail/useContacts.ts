// ---------------------------------------------------------------------------
// BETA-051 (Issue #1958) — typed contact hooks.
// ---------------------------------------------------------------------------

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { sharedTypedApi as api, queryKeys, cacheInvalidations } from "@/lib/api";
import type { Contact, ContactCreateInput } from "@/lib/api";

/** Lists the authenticated actor's contacts through the typed contacts client. */
export function useContacts(actor: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.contacts.list(actor ?? "anonymous"),
    queryFn: ({ signal }) => api.contacts.list({}, signal),
    enabled: Boolean(actor) && enabled,
  });
}

/** Creates a contact and invalidates the contact list cache. */
export function useCreateContact(actor: string | null) {
  const queryClient = useQueryClient();

  return useMutation<Contact, Error, ContactCreateInput>({
    mutationFn: (input) => api.contacts.create(input),
    onSuccess: async () => {
      for (const key of cacheInvalidations.createContact(actor ?? "anonymous")) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
