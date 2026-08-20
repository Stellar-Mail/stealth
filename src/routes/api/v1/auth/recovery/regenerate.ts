import { createFileRoute } from "@tanstack/react-router";

import { regenerateRecoveryCodes } from "@/server/api/auth/recovery";
import { parseSessionCookie, validateSession } from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { withIdempotency } from "@/server/api/idempotency-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/auth/recovery/regenerate")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const sessionId = parseSessionCookie(request.headers.get("cookie"));

          if (!sessionId) {
            throw new ApiError(401, "unauthorized", "No active session cookie found");
          }

          const activeSession = await validateSession(apiContext, sessionId);
          if (!activeSession) {
            throw new ApiError(401, "unauthorized", "Session is invalid or expired");
          }

          const repo = apiContext.repository;
          const rawIdempotencyKey = request.headers.get("x-idempotency-key");

          const regenerate = async () => {
            const result = await regenerateRecoveryCodes(apiContext, activeSession.session, {
              now: () => new Date(),
            });
            return { status: 200, body: result };
          };

          const result = rawIdempotencyKey
            ? await withIdempotency(
                repo,
                {
                  actor: activeSession.user.userId,
                  method: request.method,
                  route: "POST /auth/recovery/regenerate",
                  rawKey: rawIdempotencyKey,
                },
                {},
                regenerate,
              )
            : { ...(await regenerate()), replayed: false };

          return apiSuccess(request, result.body, {
            ...(result.replayed ? { headers: { "x-idempotency-replayed": "true" } } : {}),
          });
        }),
    },
  },
});
