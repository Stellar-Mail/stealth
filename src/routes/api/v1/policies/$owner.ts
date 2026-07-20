import { createFileRoute } from "@tanstack/react-router";

import { requireActorMatches } from "@/server/api/actor";
import { mailboxPolicySchema } from "@/server/api/domain";
import { getApiContext } from "@/server/api/context";
import { getMailboxPolicy, setMailboxPolicy } from "@/server/api/policy-service";
import { parsePolicyOwnerRouteParam } from "@/server/api/route-params";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/policies/$owner")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const owner = parsePolicyOwnerRouteParam(params.owner);
          const result = await getMailboxPolicy(getApiContext().repository, owner);
          return apiSuccess(request, result);
        }),
      PUT: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const owner = parsePolicyOwnerRouteParam(params.owner);
          requireActorMatches(request, owner);
          const policy = await parseJsonBody(request, mailboxPolicySchema);
          const result = await setMailboxPolicy(getApiContext().repository, owner, policy);
          return apiSuccess(request, result);
        }),
    },
  },
});
