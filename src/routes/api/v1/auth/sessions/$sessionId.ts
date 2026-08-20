import { createFileRoute } from "@tanstack/react-router";

import {
  parseSessionCookie,
  revokeUserSession,
  validateSession,
} from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/auth/sessions/$sessionId")({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
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

          const targetSessionId = params.sessionId;
          const host = request.headers.get("host") ?? undefined;
          const result = await revokeUserSession(
            apiContext,
            activeSession.user.userId,
            targetSessionId,
            currentSessionId,
            { host },
          );

          const response = apiSuccess(request, {
            success: result.success,
            revokedSessionId: result.revokedSessionId,
            selfRevoked: result.selfRevoked,
          });

          if (result.selfRevoked && result.cookieHeaders.length > 0) {
            for (const cookie of result.cookieHeaders) {
              response.headers.append("Set-Cookie", cookie);
            }
          }

          return response;
        }),
    },
  },
});
