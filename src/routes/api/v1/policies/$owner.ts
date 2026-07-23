import { createFileRoute } from "@tanstack/react-router";

import { parseDelegationHeader, requireActorMatches } from "@/server/api/actor";
import { mailboxPolicySchema, stellarAddressSchema } from "@/server/api/domain";
import { getApiContext } from "@/server/api/context";
import { getMailboxPolicy, setMailboxPolicy } from "@/server/api/policy-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/policies/$owner")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          const result = await getMailboxPolicy(context.repository, owner);
          return apiSuccess(request, result);
        }),
      PUT: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          requireActorMatches(
            context,
            owner,
            parseDelegationHeader(request, "policy:update", `mailbox:${owner}:policy`),
          );
          const policy = await parseJsonBody(request, mailboxPolicySchema, {
            route: "PUT /policies/{owner}",
          });
          const result = await setMailboxPolicy(context.repository, owner, policy);
          return apiSuccess(request, result);
        }),
    },
  },
});
