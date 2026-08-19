import { createFileRoute } from "@tanstack/react-router";

import { parseDelegationHeader, requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema } from "@/server/api/domain";
import { listSenderRules } from "@/server/api/policy-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/policies/$owner/senders/")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          requireActorMatches(context, owner);
          return apiSuccess(request, await listSenderRules(context.repository, owner));
        }),
    },
  },
});
