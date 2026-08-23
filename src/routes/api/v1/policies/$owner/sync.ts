import { createFileRoute } from "@tanstack/react-router";

import { parseDelegationHeader, requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema } from "@/server/api/domain";
import { syncAllPendingPolicyWrites } from "@/server/api/policy-sync-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/policies/$owner/sync")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          requireActorMatches(
            context,
            owner,
            parseDelegationHeader(request, "policy:update", `mailbox:${owner}:policy`),
          );
          const requestId = context.requestId ?? "policy-sync";
          const results = await syncAllPendingPolicyWrites(context.repository, owner, requestId);
          return apiSuccess(request, { owner, results });
        }),
    },
  },
});
