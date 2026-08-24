import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { requireAdminRole } from "@/server/api/authorization/admin";
import { ApiError } from "@/server/api/errors";
import { maskEmail } from "@/features/identity/registration";

const lookupQuerySchema = z.object({
  identifier: z.string().trim().min(1, "Identifier query parameter is required"),
});

export const Route = createFileRoute("/api/v1/admin/users/lookup")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const url = new URL(request.url);
          const { identifier } = lookupQuerySchema.parse({
            identifier: url.searchParams.get("identifier") || undefined,
          });

          // Search sequentially through repository lookup methods
          let user = await context.repository.getUserById(identifier);
          if (!user) {
            user = await context.repository.getUserByEmail(identifier);
          }
          if (!user) {
            user = await context.repository.getUserByAddress(identifier);
          }
          if (!user) {
            user = await context.repository.getUserByUsername(identifier);
          }

          if (!user) {
            throw new ApiError(404, "not_found", "User not found with the specified identifier");
          }

          // Safe projection: mask email and omit/protect keys or content
          const safeUser = {
            userId: user.userId,
            address: user.address,
            email: maskEmail(user.email),
            username: user.username,
            status: user.status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            version: user.version,
          };

          return apiSuccess(request, { user: safeUser });
        }),
    },
  },
});
