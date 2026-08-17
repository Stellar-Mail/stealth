import { createFileRoute } from "@tanstack/react-router";

import {
  parseSessionCookie,
  revokeAllSessions,
  validateSession,
} from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/auth/logout-all")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const sessionId = parseSessionCookie(request.headers.get("cookie"));

          if (!sessionId) {
            throw new ApiError(401, "unauthorized", "No active session cookie found");
          }

          const validated = await validateSession(apiContext, sessionId);
          if (!validated) {
            throw new ApiError(401, "unauthorized", "Session is invalid or expired");
          }

          const host = request.headers.get("host") ?? undefined;
          const result = await revokeAllSessions(apiContext, validated.user.userId, { host });

          const response = apiSuccess(request, {
            success: true,
            message: "All active sessions have been revoked",
          });
          for (const header of result.cookieHeaders) {
            response.headers.append("Set-Cookie", header);
          }
          return response;
        }),
    },
  },
});
