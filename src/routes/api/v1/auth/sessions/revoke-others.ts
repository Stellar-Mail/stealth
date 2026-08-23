import { createFileRoute } from "@tanstack/react-router";

import {
  parseSessionCookie,
  validateSession,
  revokeOtherSessions,
} from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/auth/sessions/revoke-others")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const currentSessionId = parseSessionCookie(request.headers.get("cookie"));

          if (!currentSessionId) {
            throw new ApiError(401, "unauthorized", "No active session cookie found");
          }

          const activeSession = await validateSession(apiContext, currentSessionId);
          if (!activeSession) {
            throw new ApiError(401, "unauthorized", "Session is invalid or expired");
          }

          // Recent login gate (15 minutes)
          const now = Date.now();
          const recentLoginAtMs = activeSession.session.recentLoginAt
            ? new Date(activeSession.session.recentLoginAt).getTime()
            : Number.NEGATIVE_INFINITY;
          if (now - recentLoginAtMs > 15 * 60 * 1000) {
            throw new ApiError(
              403,
              "forbidden",
              "This action requires a recent login. Please sign in again.",
            );
          }

          await revokeOtherSessions(apiContext, activeSession.user.userId, currentSessionId);

          return apiSuccess(request, { success: true });
        }),
    },
  },
});
