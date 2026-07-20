import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { senderRuleSchema, stellarAddressSchema } from "@/server/api/domain";
import { getSenderRule, setSenderRule } from "@/server/api/policy-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const ruleBodySchema = z.object({ rule: senderRuleSchema.exclude(["default"]) });

function emitAudit(params: {
  action: "allow" | "block" | "update" | "delete";
  owner: string;
  sender: string;
  actor: string;
  timestamp: string;
}) {
  const record = { event: "policy.sender.mutation", ...params };
  console.log(JSON.stringify(record));
}

export const Route = createFileRoute("/api/v1/policies/$owner/senders/$sender")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const owner = stellarAddressSchema.parse(params.owner);
          const sender = stellarAddressSchema.parse(params.sender);
          return apiSuccess(
            request,
            await getSenderRule((await getApiContext()).repository, owner, sender),
          );
        }),
      PUT: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const owner = stellarAddressSchema.parse(params.owner);
          const sender = stellarAddressSchema.parse(params.sender);
          requireActorMatches(request, owner);
          const { rule } = await parseJsonBody(request, ruleBodySchema);
          const result = await setSenderRule((await getApiContext()).repository, owner, sender, rule);
          emitAudit({
            action: rule === "allow" ? "allow" : rule === "block" ? "block" : "update",
            owner,
            sender,
            actor: owner,
            timestamp: new Date().toISOString(),
          });
          return apiSuccess(request, result);
        }),
      DELETE: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const owner = stellarAddressSchema.parse(params.owner);
          const sender = stellarAddressSchema.parse(params.sender);
          requireActorMatches(request, owner);
          const result = await setSenderRule((await getApiContext()).repository, owner, sender, "default");
          emitAudit({
            action: "delete",
            owner,
            sender,
            actor: owner,
            timestamp: new Date().toISOString(),
          });
          return apiSuccess(request, result);
        }),
    },
  },
});