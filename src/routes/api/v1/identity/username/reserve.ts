import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { reserveUsername } from "@/features/identity/username-validation";
import { getApiContext } from "@/server/api/context";
import { requireActor } from "@/server/api/actor";
import { handleApiRequest, apiSuccess } from "@/server/api/response";
import { parseJsonBody } from "@/server/api/request";

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
