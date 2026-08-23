import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  parseSessionCookie,
  validateSession,
  hashSessionId,
  logoutSession,
  revokeSessionById,
} from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const revokeSchema = z.object({
  id: z.string().min(1, "Session hash ID is required"),
});

export const Route = createFileRoute("/api/v1/auth/sessions/revoke")({
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

          const body = (await parseJsonBody(request, revokeSchema, {
            route: "POST /auth/sessions/revoke" as any,
          })) as { id: string };

          const repo = apiContext.repository;
          const sessions = await repo.listUserSessions(activeSession.user.userId);

          let targetSessionId: string | null = null;
          for (const s of sessions) {
            const h = await hashSessionId(s.sessionId);
            if (h === body.id) {
              targetSessionId = s.sessionId;
              break;
            }
          }

          if (!targetSessionId) {
            throw new ApiError(404, "not_found", "Session not found");
          }

          if (targetSessionId === currentSessionId) {
            // Self-revocation: log out safely
            const logoutResult = await logoutSession(apiContext, currentSessionId);
            const response = apiSuccess(request, { success: true });
            for (const header of logoutResult.cookieHeaders) {
              response.headers.append("Set-Cookie", header);
            }
            return response;
          }

          await revokeSessionById(apiContext, activeSession.user.userId, targetSessionId);
          return apiSuccess(request, { success: true });
        }),
    },
  },
});
