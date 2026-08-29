import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor, requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema } from "@/server/api/domain";
import {
  assertPostageParticipant,
  disputePostage,
  expirePostage,
  getPostage,
  reclaimPostage,
  resolvePostage,
} from "@/server/api/postage-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { withIdempotency } from "@/server/api/idempotency-service";
import { enforceCapability } from "@/server/api/beta-controls/guard";

const transitionOperationSchema = z.enum(["settle", "refund", "dispute", "expire", "reclaim"]);

const transitionBodySchema = z.object({
  operation: transitionOperationSchema,
});

export const Route = createFileRoute("/api/v1/postage/$messageId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const messageId = hash32Schema.parse(params.messageId);
          const actor = requireActor(context);
          const postage = await getPostage(context.repository, messageId);
          assertPostageParticipant(postage, actor);
          return apiSuccess(request, postage);
        }),

      PATCH: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const messageId = hash32Schema.parse(params.messageId);

          // BETA-095: operator kill switch for postage writes. Fails closed.
          // This PATCH route can settle, refund, dispute, expire and reclaim, so
          // every transition must be gated, not just the dedicated handlers.
          await enforceCapability("postageWrites");

          const readForAuth = await getPostage(context.repository, messageId);
          assertPostageParticipant(readForAuth, actor);

          const body = await parseJsonBody(request, transitionBodySchema, {
            route: "PATCH /postage/:messageId",
          });

          const repo = context.repository;
          const rawIdempotencyKey = request.headers.get("x-idempotency-key");

          const perform = async () => {
            switch (body.operation) {
              case "settle":
                requireActorMatches(context, readForAuth.recipient);
                return {
                  status: 200 as const,
                  body: await resolvePostage(context, messageId, "settled"),
                };
              case "refund":
                requireActorMatches(context, readForAuth.recipient);
                return {
                  status: 200 as const,
                  body: await resolvePostage(context, messageId, "refunded"),
                };
              case "dispute":
                requireActorMatches(context, readForAuth.recipient);
                return {
                  status: 200 as const,
                  body: await disputePostage(context, messageId),
                };
              case "expire":
                return {
                  status: 200 as const,
                  body: await expirePostage(context, messageId),
                };
              case "reclaim":
                requireActorMatches(context, readForAuth.sender);
                return {
                  status: 200 as const,
                  body: await reclaimPostage(context, messageId),
                };
            }
          };

          const result = rawIdempotencyKey
            ? await withIdempotency(
                repo,
                {
                  actor,
                  method: request.method,
                  route: "PATCH /postage/:messageId",
                  rawKey: rawIdempotencyKey,
                },
                body,
                perform,
                { cacheableErrorStatuses: [409, 422] },
              )
            : { ...(await perform()), replayed: false };

          return apiSuccess(request, result.body, {
            status: result.status,
            ...(result.replayed ? { headers: { "x-idempotency-replayed": "true" } } : {}),
          });
        }),
    },
  },
});
