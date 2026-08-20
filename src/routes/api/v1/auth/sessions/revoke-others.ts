import { createFileRoute } from "@tanstack/react-router";

import {
  parseSessionCookie,
  revokeOtherUserSessions,
  validateSession,
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

          const result = await revokeOtherUserSessions(
            apiContext,
            activeSession.user.userId,
            currentSessionId,
          );

          return apiSuccess(request, result);
        }),
    },
  },
});
