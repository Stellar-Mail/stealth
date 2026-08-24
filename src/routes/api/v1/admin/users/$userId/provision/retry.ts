import { createFileRoute } from "@tanstack/react-router";
import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  requireAdminRole,
  recordAdminMutationAudit,
  adminMutationSchema,
} from "@/server/api/authorization/admin";
import { retryAccountProvisioning } from "@/server/api/account-provisioning";
import { ApiError } from "@/server/api/errors";

export const Route = createFileRoute("/api/v1/admin/users/$userId/provision/retry")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const body = await request.json();
          const parsed = adminMutationSchema.parse(body);

          const userId = params.userId;
          const record = await context.repository.getProvisioningRecord(userId);
          if (!record) {
            throw new ApiError(404, "not_found", "No provisioning record exists for this account");
          }

          const beforeState = { ...record };

          // Execute retry flow
          const progress = await retryAccountProvisioning(context.repository, userId);

          // Fetch the updated record for auditing
          const afterRecord = await context.repository.getProvisioningRecord(userId);

          const supportId = recordAdminMutationAudit({
            actor: context.principal!.address,
            action: "provision.retry",
            target: `user:${userId}:provision`,
            reason: parsed.reason,
            beforeState,
            afterState: afterRecord,
            requestId: context.requestId || "",
            result: "success",
          });

          return apiSuccess(request, { progress, supportId });
        }),
    },
  },
});
