import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { parseDelegationHeader, requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { senderRuleChainStatusSchema, stellarAddressSchema } from "@/server/api/domain";
import { transitionSenderRuleChainStatus } from "@/server/api/sender-rule-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const transitionBodySchema = z
  .object({
    chainStatus: senderRuleChainStatusSchema,
    txHash: z.string().optional(),
    lastError: z.string().max(300).optional(),
  })
  .refine(
    (data) => {
      if (data.chainStatus === "confirmed" && !data.txHash) return false;
      return true;
    },
    { message: "txHash is required when transitioning to 'confirmed'" },
  );

export const Route = createFileRoute("/api/v1/policies/$owner/senders/$sender/chain-status")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
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

          const body = await parseJsonBody(request, transitionBodySchema, {
            route: "POST /policies/{owner}/senders/{sender}/chain-status",
          });

          const updated = await transitionSenderRuleChainStatus(
            context.repository,
            owner,
            sender,
            body.chainStatus,
            { txHash: body.txHash, lastError: body.lastError },
          );

          return apiSuccess(request, {
            owner: updated.owner,
            sender: updated.sender,
            rule: updated.rule,
            version: updated.version,
            chainStatus: updated.chainStatus,
            txHash: updated.txHash,
            updatedAt: updated.updatedAt,
          });
        }),
    },
  },
});
