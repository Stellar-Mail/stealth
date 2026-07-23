import { createFileRoute } from "@tanstack/react-router";

import { requireActor, requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema } from "@/server/api/domain";
import { getPostage, resolvePostage } from "@/server/api/postage-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { acquireIdempotency, recordIdempotency } from "@/server/api/idempotency-service";
import { ApiError } from "@/server/api/errors";

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
          const messageId = hash32Schema.parse(params.messageId);
          const current = await getPostage(repository, messageId);
          requireActorMatches(context, current.recipient);

          // Check for idempotency key to enable safe retries
          const rawIdempotencyKey = request.headers.get("x-idempotency-key");
          if (rawIdempotencyKey) {
            const result = await acquireIdempotency(
              repository,
              current.recipient,
              rawIdempotencyKey,
            );

            if (result.status === "in_progress") {
              throw new ApiError(409, "conflict", "Request is already in progress");
            }

            if (result.status === "completed") {
              // Replay the previous response (success or failure)
              return apiSuccess(request, result.record.body, {
                status: result.record.status,
                headers: { "x-idempotency-replayed": "true" },
              });
            }
          }

          try {
            const postage = await resolvePostage(repository, messageId, "settled");

            // Record successful settlement for idempotent replay
            if (rawIdempotencyKey) {
              await recordIdempotency(
                repository,
                current.recipient,
                rawIdempotencyKey,
                200,
                postage,
              );
            }

            return apiSuccess(request, postage);
          } catch (error) {
            // Record terminal-state errors for idempotent replay
            // This ensures retry-after-failure returns the same error
            if (
              rawIdempotencyKey &&
              error &&
              typeof error === "object" &&
              "status" in error &&
              "code" in error &&
              "message" in error
            ) {
              const apiError = error as {
                status: number;
                code: string;
                message: string;
                details?: unknown;
              };
              // Only cache terminal-state errors (409 conflict), not transient failures
              if (apiError.status === 409) {
                await recordIdempotency(repository, current.recipient, rawIdempotencyKey, 409, {
                  error: {
                    code: apiError.code,
                    message: apiError.message,
                    details: apiError.details,
                  },
                });
              }
            }
            throw error;
          }
        }),
    },
  },
});
