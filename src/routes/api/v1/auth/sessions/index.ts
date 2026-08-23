import { createFileRoute } from "@tanstack/react-router";

import {
  parseSessionCookie,
  validateSession,
  hashSessionId,
  parseUserAgent,
  getApproximateRegion,
} from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/auth/sessions/")({
  server: {
    handlers: {
      GET: ({ request }) =>
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

          const repo = apiContext.repository;
          const sessions = await repo.listUserSessions(activeSession.user.userId);

          const data = await Promise.all(
            sessions.map(async (s) => {
              const id = await hashSessionId(s.sessionId);
              return {
                id,
                device: parseUserAgent(s.userAgent ?? null),
                region: getApproximateRegion(s.ipAddress ?? null),
                created: s.createdAt,
                lastUsed: s.lastActiveAt,
                isCurrent: s.sessionId === currentSessionId,
              };
            }),
          );

          return apiSuccess(request, data);
        }),
    },
  },
});
