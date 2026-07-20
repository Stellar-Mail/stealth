import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { senderRuleSchema } from "@/server/api/domain";
import { parsePolicyOwnerRouteParam, parsePolicySenderRouteParam } from "@/server/api/route-params";
import { getSenderRule, setSenderRule } from "@/server/api/policy-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const ruleBodySchema = z.object({ rule: senderRuleSchema.exclude(["default"]) });

export const Route = createFileRoute("/api/v1/policies/$owner/senders/$sender")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const owner = parsePolicyOwnerRouteParam(params.owner);
          const sender = parsePolicySenderRouteParam(params.sender);
          return apiSuccess(
            request,
            await getSenderRule((await getApiContext()).repository, owner, sender),
          );
        }),
      PUT: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const owner = parsePolicyOwnerRouteParam(params.owner);
          const sender = parsePolicySenderRouteParam(params.sender);
          requireActorMatches(request, owner);
          const { rule } = await parseJsonBody(request, ruleBodySchema);
          return apiSuccess(
            request,
            await setSenderRule((await getApiContext()).repository, owner, sender, rule),
          );
        }),
      DELETE: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const owner = parsePolicyOwnerRouteParam(params.owner);
          const sender = parsePolicySenderRouteParam(params.sender);
          requireActorMatches(request, owner);
          return apiSuccess(
            request,
            await setSenderRule((await getApiContext()).repository, owner, sender, "default"),
          );
        }),
    },
  },
});
