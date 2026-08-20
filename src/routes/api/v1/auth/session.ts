import { createFileRoute } from "@tanstack/react-router";

import {
  buildSessionCookie,
  parseSessionCookie,
  renewSession,
  validateSession,
} from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { toPublicSession, toPublicUser } from "@/server/api/domain";
import { ApiError } from "@/server/api/errors";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/auth/session")({
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

          const nowMs = Date.now();
          const expiresMs = new Date(activeSession.session.expiresAt).getTime();
          const maxAgeSeconds = Math.max(0, Math.floor((expiresMs - nowMs) / 1000));
          const isProd = import.meta.env?.PROD ?? false;
          const cookieHeader = buildSessionCookie(
            activeSession.session.sessionId,
            maxAgeSeconds,
            isProd,
          );

          const response = apiSuccess(request, {
            user: toPublicUser(activeSession.user),
            session: toPublicSession(activeSession.session),
          });
          response.headers.append("Set-Cookie", cookieHeader);
          return response;
        }),

      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const sessionId = parseSessionCookie(request.headers.get("cookie"));

          if (!sessionId) {
            throw new ApiError(401, "unauthorized", "No active session cookie found");
          }

          const renewed = await renewSession(apiContext, sessionId);

          const response = apiSuccess(request, {
            user: toPublicUser(renewed.user),
            session: toPublicSession(renewed.session),
          });
          response.headers.append("Set-Cookie", renewed.cookieHeader);
          return response;
        }),
    },
  },
});
