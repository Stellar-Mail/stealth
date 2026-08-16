import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { checkUsernameAvailability } from "@/server/api/identity-service";
import { consumeRouteQuota } from "@/server/api/rate-limit";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { RAW_USERNAME_MAX_LENGTH } from "@/features/identity/username";

const paramsSchema = z.object({
  username: z.string().min(1).max(RAW_USERNAME_MAX_LENGTH),
});

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * GET /api/v1/identity/usernames/{username}/availability
 *
 * Public (no wallet required yet) so a new visitor can get live feedback
 * while typing a candidate handle. The response never distinguishes "taken"
 * from "reserved" internally — malformed or reserved-word input fails
 * request validation (422) before the repository is ever consulted, and a
 * real, currently-held reservation only ever yields a boolean with no owner
 * information, so the endpoint cannot be used to enumerate account details.
 */
export const Route = createFileRoute("/api/v1/identity/usernames/$username/availability")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const { username } = paramsSchema.parse(params);

          const ip = clientIp(request);
          const quota = await consumeRouteQuota(context.repository, "ip", ip, "read");
          if (!quota.allowed) {
            throw new ApiError(429, "too_many_requests", "IP limit exceeded", {
              retryAfterSeconds: quota.retryAfterSeconds,
            });
          }

          const result = await checkUsernameAvailability(context.repository, username);
          return apiSuccess(request, result, { cachePolicy: "NO_STORE" });
        }),
    },
  },
});
