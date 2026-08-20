// ---------------------------------------------------------------------------
// BETA-069 (Issue #1976) — Account Info API (read-only)
//
// GET /api/v1/accounts/account-info → Returns immutable account identifiers,
//                                     network status, and beta limitations.
// ---------------------------------------------------------------------------

import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { getAccountProfile } from "@/server/api/account-settings-service";

export const Route = createFileRoute("/api/v1/accounts/account-info")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const requestId = context.requestId ?? crypto.randomUUID();

          const result = await getAccountProfile(context.repository, actor, requestId);

          // Return only the immutable account info portion
          return apiSuccess(request, { account: result.account });
        }),
    },
  },
});
