import { createFileRoute } from "@tanstack/react-router";

import { getApiContext } from "@/server/api/context";
import { withIdempotency } from "@/server/api/idempotency-service";
import {
  completeOnboarding,
  onboardingCompleteSchema,
  resolveSessionUser,
} from "@/server/api/onboarding-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/onboarding/complete")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const user = await resolveSessionUser(context.repository, request.headers.get("cookie"));
          const input = await parseJsonBody(request, onboardingCompleteSchema, {
            route: "POST /api/v1/onboarding/complete",
          });

          const rawIdempotencyKey = request.headers.get("x-idempotency-key");
          const complete = async () => {
            const result = await completeOnboarding(context.repository, user, input.draft);
            return { status: 200, body: result };
          };

          const result = rawIdempotencyKey
            ? await withIdempotency(
                context.repository,
                {
                  actor: user.userId,
                  method: request.method,
                  route: "/api/v1/onboarding/complete",
                  rawKey: rawIdempotencyKey,
                },
                input,
                complete,
              )
            : { ...(await complete()), replayed: false };

          return apiSuccess(request, result.body, {
            status: result.status,
            ...(result.replayed ? { headers: { "x-idempotency-replayed": "true" } } : {}),
          });
        }),
    },
  },
});
