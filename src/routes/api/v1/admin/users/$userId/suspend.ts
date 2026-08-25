import { createFileRoute } from "@tanstack/react-router";
import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  requireAdminRole,
  recordAdminMutationAudit,
  adminMutationSchema,
} from "@/server/api/authorization/admin";
import { ApiError } from "@/server/api/errors";

export const Route = createFileRoute("/api/v1/admin/users/$userId/suspend")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const body = await request.json();
          const parsed = adminMutationSchema.parse(body);

          const userId = params.userId;
          let attempts = 0;
          while (attempts < 3) {
            const user = await context.repository.getUserById(userId);
            if (!user) {
              throw new ApiError(404, "not_found", "User not found");
            }
            if (user.status === "suspended") {
              throw new ApiError(409, "conflict", "User is already suspended");
            }

            const beforeState = { ...user };
            const updated = {
              ...user,
              status: "suspended" as const,
              updatedAt: new Date().toISOString(),
            };

            const res = await context.repository.updateUser(updated, user.version);
            if (res.updated && res.user) {
              const supportId = recordAdminMutationAudit({
                actor: context.principal!.address,
                action: "user.suspend",
                target: `user:${userId}`,
                reason: parsed.reason,
                beforeState,
                afterState: res.user,
                requestId: context.requestId || "",
                result: "success",
              });

              return apiSuccess(request, { user: res.user, supportId });
            }
            attempts++;
          }

          throw new ApiError(409, "conflict", "Failed to suspend user due to concurrent updates");
        }),
    },
  },
});
