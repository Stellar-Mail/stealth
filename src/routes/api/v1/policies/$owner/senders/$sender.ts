import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { parseDelegationHeader, requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { senderRuleSchema, stellarAddressSchema } from "@/server/api/domain";
import { getSenderRule, setSenderRule } from "@/server/api/policy-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const ruleBodySchema = z.object({ rule: senderRuleSchema.exclude(["default"]) });

export const Route = createFileRoute("/api/v1/policies/$owner/senders/$sender")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          const sender = stellarAddressSchema.parse(params.sender);
          return apiSuccess(request, await getSenderRule(context.repository, owner, sender));
        }),
      PUT: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          const sender = stellarAddressSchema.parse(params.sender);
          requireActorMatches(
            context,
            owner,
            parseDelegationHeader(
              request,
              "policy:senders:update",
              `mailbox:${owner}:senders:${sender}`,
            ),
          );
          const { rule } = await parseJsonBody(request, ruleBodySchema, {
            route: "PUT /policies/{owner}/senders/{sender}",
          });
          return apiSuccess(request, await setSenderRule(context.repository, owner, sender, rule));
        }),
      DELETE: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          const sender = stellarAddressSchema.parse(params.sender);
          requireActorMatches(
            context,
            owner,
            parseDelegationHeader(
              request,
              "policy:senders:delete",
              `mailbox:${owner}:senders:${sender}`,
            ),
          );
          return apiSuccess(
            request,
            await setSenderRule(context.repository, owner, sender, "default"),
          );
        }),
    },
  },
});
