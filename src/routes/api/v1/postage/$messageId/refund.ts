import { createFileRoute } from "@tanstack/react-router";

import { requireActor, requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema } from "@/server/api/domain";
import { getPostage, resolvePostage } from "@/server/api/postage-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { withIdempotency } from "@/server/api/idempotency-service";
import { enforceCapability } from "@/server/api/beta-controls/guard";

/**
 * POST /api/v1/postage/:messageId/refund
 *
 * Refunds postage for a message, returning escrow to the sender.
 *
 * ## Idempotency
 *
 * Mirrors the settlement endpoint: supports idempotent refunds via the
 * optional `X-Idempotency-Key` header, scoped per recipient. A matching
 * completed record is replayed; a matching in-flight request is rejected as
 * in-progress; the same key reused with a different message id conflicts.
 */
export const Route = createFileRoute("/api/v1/postage/$messageId/refund")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const repository = context.repository;
          // Authenticate before loading so unauthenticated callers cannot
          // probe whether a message id exists.
          requireActor(context);

          // BETA-095: operator kill switch for postage writes. Fails closed.
          await enforceCapability("postageWrites");

          const messageId = hash32Schema.parse(params.messageId);
          const current = await getPostage(repository, messageId);
          requireActorMatches(context, current.recipient);

          const rawIdempotencyKey = request.headers.get("x-idempotency-key");
          const refund = async () => {
            const postage = await resolvePostage(context, messageId, "refunded");
            return { status: 200, body: postage };
          };

          const result = rawIdempotencyKey
            ? await withIdempotency(
                repository,
                {
                  actor: current.recipient,
                  method: request.method,
                  route: "POST /postage/{messageId}/refund",
                  rawKey: rawIdempotencyKey,
                },
                { messageId },
                refund,
                { cacheableErrorStatuses: [409] },
              )
            : { ...(await refund()), replayed: false };

          return apiSuccess(request, result.body, {
            status: result.status,
            ...(result.replayed ? { headers: { "x-idempotency-replayed": "true" } } : {}),
          });
        }),
    },
  },
});
