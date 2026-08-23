import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { parseDelegationHeader, requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema } from "@/server/api/domain";
import { syncVersionedSenderRuleRecord } from "@/server/api/policy-sync-service";
import { retrySenderRuleWrite } from "@/server/api/sender-rule-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const retryBodySchema = z.object({});

export const Route = createFileRoute("/api/v1/policies/$owner/senders/$sender/retry")({
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

          await parseJsonBody(request, retryBodySchema, {
            route: "POST /policies/{owner}/senders/{sender}/retry",
          });

          const pending = await retrySenderRuleWrite(context.repository, owner, sender);
          const synced = await syncVersionedSenderRuleRecord(
            context.repository,
            pending,
            context.requestId ?? "policy-sync",
          );

          return apiSuccess(request, {
            owner: synced.owner,
            sender: synced.sender,
            rule: synced.rule,
            version: synced.version,
            chainStatus: synced.chainStatus,
            txHash: synced.txHash,
          });
        }),
    },
  },
});
