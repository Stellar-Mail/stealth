import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import {
  checkUsernameAvailability,
  normalizeUsername,
} from "@/features/identity/username-validation";
import { getApiContext } from "@/server/api/context";
import { handleApiRequest, apiSuccess } from "@/server/api/response";

const usernameCheckQuerySchema = z.object({
  username: z.string().min(1, "Username is required").max(200),
});

export const Route = createFileRoute("/api/v1/identity/username/check")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const url = new URL(request.url);
          const query = usernameCheckQuerySchema.parse({
            username: url.searchParams.get("username") ?? "",
          });
          const context = await getApiContext(request);
          const canonical = normalizeUsername(query.username);
          const result = await checkUsernameAvailability(canonical, {
            getUserByUsername: (u) => context.repository.getUserByUsername(u),
            getUsernameReservation: (u) => context.repository.getUsernameReservation(u),
          });
          return apiSuccess(request, result);
        }),
    },
  },
});
