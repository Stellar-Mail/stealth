import { createFileRoute } from "@tanstack/react-router";

import { requireActor, requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema } from "@/server/api/domain";
import { getPostage, resolvePostage } from "@/server/api/postage-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { withIdempotency } from "@/server/api/idempotency-service";
import { enforceCapability } from "@/server/api/beta-controls/guard";

/**
 * POST /api/v1/postage/:messageId/settle
 *
 * Settles postage for a delivered message, marking it as paid and releasing escrow.
 *
 * ## Idempotency
 *
 * This endpoint supports idempotent settlement via the optional `X-Idempotency-Key` header.
 * When provided:
 * - Multiple settlement requests with the same key will return the same response
 * - The first successful settlement is recorded and replayed on subsequent requests
 * - If settlement fails (e.g., already settled), the error is cached and replayed
 * - Idempotency keys are scoped per recipient to prevent cross-actor collisions
 *
 * ## Retry Safety
 *
 * Settlement operations are safe to retry:
 * - If postage is already settled, returns 409 with explanation
 * - If postage is refunded, returns 409 with current state
 * - Network failures do not cause double-settlement
 * - Terminal states (settled/refunded) are deterministic
 *
 * @example
 * ```
 * POST /api/v1/postage/abc123.../settle
 * X-Idempotency-Key: unique-settlement-request-id
 * Authorization: Bearer <recipient-token>
 * ```
 */
export const Route = createFileRoute("/api/v1/postage/$messageId/settle")({
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

          // Check for idempotency key to enable safe retries
          const rawIdempotencyKey = request.headers.get("x-idempotency-key");
          const settle = async () => {
            const postage = await resolvePostage(context, messageId, "settled");
            return { status: 200, body: postage };
          };

          const result = rawIdempotencyKey
            ? await withIdempotency(
                repository,
                {
                  actor: current.recipient,
                  method: request.method,
                  route: "POST /postage/{messageId}/settle",
                  rawKey: rawIdempotencyKey,
                },
                { messageId },
                settle,
                { cacheableErrorStatuses: [409] },
              )
            : { ...(await settle()), replayed: false };

          return apiSuccess(request, result.body, {
            status: result.status,
            ...(result.replayed ? { headers: { "x-idempotency-replayed": "true" } } : {}),
          });
        }),
    },
  },
});
