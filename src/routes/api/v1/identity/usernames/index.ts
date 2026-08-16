import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { RAW_USERNAME_MAX_LENGTH } from "@/features/identity/username";
import { reserveUsername } from "@/server/api/identity-service";
import { withIdempotency } from "@/server/api/idempotency-service";
import { consumeRouteQuota } from "@/server/api/rate-limit";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const reservationBodySchema = z.object({
  username: z.string().min(1).max(RAW_USERNAME_MAX_LENGTH),
});

/**
 * POST /api/v1/identity/usernames
 *
 * Reserves `username@stealth.me` for the authenticated actor. Supports the
 * standard `X-Idempotency-Key` retry contract (see idempotency-service.ts),
 * so a client retrying after a dropped response cannot double-submit; the
 * underlying repository call additionally guarantees exactly one winner
 * across genuinely concurrent claims for the same normalized username.
 */
export const Route = createFileRoute("/api/v1/identity/usernames/")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actorId = requireActor(context);

          const quota = await consumeRouteQuota(
            context.repository,
            "account",
            actorId,
            "signatureVerification",
          );
          if (!quota.allowed) {
            throw new ApiError(429, "too_many_requests", "Account limit exceeded", {
              retryAfterSeconds: quota.retryAfterSeconds,
            });
          }

          const input = await parseJsonBody(request, reservationBodySchema, "minimal");

          const rawIdempotencyKey = request.headers.get("x-idempotency-key");
          const reserve = async () => {
            const record = await reserveUsername(
              context.repository,
              { rawUsername: input.username, ownerAddress: actorId },
              new Date(),
              context.requestId ?? "unknown",
            );
            return { status: 201, body: record };
          };

          const result = rawIdempotencyKey
            ? await withIdempotency(
                context.repository,
                {
                  actor: actorId,
                  method: request.method,
                  route: "POST /identity/usernames",
                  rawKey: rawIdempotencyKey,
                },
                input,
                reserve,
                { cacheableErrorStatuses: [409] },
              )
            : { ...(await reserve()), replayed: false };

          return apiSuccess(request, result.body, {
            status: result.status,
            ...(result.replayed ? { headers: { "x-idempotency-replayed": "true" } } : {}),
          });
        }),
    },
  },
});
