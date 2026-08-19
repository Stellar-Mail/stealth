import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { emailSchema, usernameSchema } from "@/server/api/domain";
import { provisionAccount } from "@/server/api/account-provisioning";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { withIdempotency } from "@/server/api/idempotency-service";

const provisionBodySchema = z.object({
  email: emailSchema.optional(),
  username: usernameSchema.optional(),
  displayName: z
    .string()
    .trim()
    .min(1, "Display name cannot be empty")
    .max(80, "Display name cannot exceed 80 characters")
    .optional(),
});

export const Route = createFileRoute("/api/v1/accounts/")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const input = await parseJsonBody(request, provisionBodySchema, {
            route: "POST /accounts",
          });

          const rawIdempotencyKey = request.headers.get("x-idempotency-key");
          const provision = async () => {
            const progress = await provisionAccount(context.repository, {
              address: actor,
              username: input.username ?? "",
              email: input.email,
              displayName: input.displayName ?? null,
            });
            return { status: 200, body: progress };
          };

          const result = rawIdempotencyKey
            ? await withIdempotency(
                context.repository,
                {
                  actor,
                  method: request.method,
                  route: "POST /accounts",
                  rawKey: rawIdempotencyKey,
                },
                input,
                provision,
                // Deterministic conflicts (409 username conflicts, terminal
                // invalid_state_transition) are safe to cache and replay;
                // transient failures must never be cached so the same key
                // can be retried immediately.
                { cacheableErrorStatuses: [409] },
              )
            : { ...(await provision()), replayed: false };

          return apiSuccess(request, result.body, {
            status: result.status,
            ...(result.replayed ? { headers: { "x-idempotency-replayed": "true" } } : {}),
          });
        }),
    },
  },
});
