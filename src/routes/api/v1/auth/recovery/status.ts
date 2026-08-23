import { createFileRoute } from "@tanstack/react-router";

import { getRecoveryStatus } from "@/server/api/auth/recovery";
import { parseSessionCookie, validateSession } from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/auth/recovery/status")({
  server: {
    handlers: {
      GET: ({ request }) =>
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

          const status = await getRecoveryStatus(apiContext, activeSession.user.userId);
          return apiSuccess(request, status);
        }),
    },
  },
});
