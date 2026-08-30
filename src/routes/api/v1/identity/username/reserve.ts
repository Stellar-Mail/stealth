import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { reserveUsername } from "@/features/identity/username-validation";
import { getApiContext } from "@/server/api/context";
import { requireActor } from "@/server/api/actor";
import { handleApiRequest, apiSuccess } from "@/server/api/response";
import { parseJsonBody } from "@/server/api/request";
import { checkUsernameReservationLimit } from "@/server/api/abuse-service";
import { ApiError } from "@/server/api/errors";

const usernameReserveBodySchema = z.object({
  username: z.string().min(1, "Username is required").max(200),
});

export const Route = createFileRoute("/api/v1/identity/username/reserve")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const body = await parseJsonBody(request, usernameReserveBodySchema, "compact");
          const context = await getApiContext(request);
          const actorId = requireActor(context);

          // BETA-079: Enforce username reservation rate limit per IP
          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";
          const rateCheck = await checkUsernameReservationLimit(context.repository, ip);
          if (!rateCheck.allowed) {
            throw new ApiError(
              429,
              "too_many_requests",
              "Username reservation rate limit exceeded",
              {
                retryAfterSeconds: rateCheck.retryAfterSeconds ?? 3600,
              },
            );
          }

          const result = await reserveUsername(body.username, actorId, {
            reserveUsername: (username, userId, leaseMs) =>
              context.repository.reserveUsername(username, userId, leaseMs),
            getUserByUsername: (u) => context.repository.getUserByUsername(u),
          });
          return apiSuccess(request, result);
        }),
    },
  },
});
