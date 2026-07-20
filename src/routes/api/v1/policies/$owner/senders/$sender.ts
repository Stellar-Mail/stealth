import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActorMatches } from "@/server/api/actor";
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
          const owner = stellarAddressSchema.parse(params.owner);
          const sender = stellarAddressSchema.parse(params.sender);
          return apiSuccess(
            request,
            await getSenderRule(getApiContext().repository, owner, sender),
          );
        }),
      PUT: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const owner = stellarAddressSchema.parse(params.owner);
          const sender = stellarAddressSchema.parse(params.sender);
          const actor = requireActorMatches(request, owner);
          const { rule } = await parseJsonBody(request, ruleBodySchema);
          return apiSuccess(
            request,
            await setSenderRule(getApiContext().repository, owner, sender, rule, {
              request,
              actor,
            }),
          );
        }),
      DELETE: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const owner = stellarAddressSchema.parse(params.owner);
          const sender = stellarAddressSchema.parse(params.sender);
          const actor = requireActorMatches(request, owner);
          return apiSuccess(
            request,
            await setSenderRule(getApiContext().repository, owner, sender, "default", {
              request,
              actor,
            }),
          );
        }),
    },
  },
});
