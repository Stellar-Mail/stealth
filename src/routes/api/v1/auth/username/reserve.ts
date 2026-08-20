import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { validateUsername } from "@/features/identity/username";
import { parseSessionCookie } from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const reserveRequestSchema = z.object({
  username: z.string(),
  userId: z.string().optional(),
  leaseMs: z.number().int().positive().optional(),
});

export const Route = createFileRoute("/api/v1/auth/username/reserve")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const parsed = reserveRequestSchema.safeParse(body);

          if (!parsed.success) {
            throw new ApiError(422, "validation_error", "Username is required for reservation");
          }

          const { username: rawUsername, leaseMs = 15 * 60 * 1000 } = parsed.data;
          const apiContext = await getApiContext(request);

          const validation = validateUsername(rawUsername);
          if (!validation.valid) {
            return apiSuccess(request, {
              outcome: "unavailable" as const,
              reason: validation.reason,
              message: validation.message,
              canonicalEmail: validation.canonicalEmail ?? "",
              federationHandle: validation.federationHandle ?? "",
            });
          }

          const norm = validation.normalized;

          // Determine actor ID (session user ID, body userId, or generated visitor token)
          let userId = parsed.data.userId;

          if (!userId) {
            const sessionId = parseSessionCookie(request.headers.get("cookie"));
            if (sessionId) {
              const sessionRecord = await apiContext.repository.getSession(sessionId);
              if (sessionRecord) {
                userId = sessionRecord.userId;
              }
            }
          }

          if (!userId) {
            userId = `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          }

          const result = await apiContext.repository.reserveUsername(norm, userId, leaseMs);

          return apiSuccess(request, {
            outcome: result.outcome,
            reservation: "reservation" in result ? result.reservation : null,
            canonicalEmail: validation.canonicalEmail ?? "",
            federationHandle: validation.federationHandle ?? "",
          });
        }),
    },
  },
});
