// ---------------------------------------------------------------------------
// BETA-051 (Issue #1958) — typed session hook.
// ---------------------------------------------------------------------------

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { sharedTypedApi as api, queryKeys, cacheInvalidations } from "@/lib/api";
import type { SessionBundle } from "@/lib/api";

export interface UseSessionOptions {
  /** Disables the query entirely (e.g. while an account is unauthenticated). */
  enabled?: boolean;
}

/**
 * Reads the active authenticated session through the typed auth client. The
 * server extends the session cookie on each read, so the query uses a
 * moderate staleTime and never fires when explicitly disabled.
 */
export function useSession(options: UseSessionOptions = {}) {
  return useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: ({ signal }) => api.auth.getSession(signal),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

/** Logs the current session out and invalidates the session query. */
export function useLogout() {
  const queryClient = useQueryClient();

  async function logout(): Promise<void> {
    await api.auth.logout();
    for (const key of cacheInvalidations.sessionLogout()) {
      queryClient.removeQueries({ queryKey: key });
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
  }

  return { logout };
}

/** Exposes the session bundle when present, for consumers that need the actor. */
export function sessionActor(session: SessionBundle | undefined): string | null {
  return session?.user.address ?? null;
}
