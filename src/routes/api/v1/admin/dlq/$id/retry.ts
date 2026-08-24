import { createFileRoute } from "@tanstack/react-router";
import { getApiContext } from "@/server/api/context";
import { retryDeadLetter, getDeadLetter } from "@/server/api/job-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  requireAdminRole,
  recordAdminMutationAudit,
  adminMutationSchema,
} from "@/server/api/authorization/admin";

export const Route = createFileRoute("/api/v1/admin/dlq/$id/retry")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const body = await request.json();
          const parsed = adminMutationSchema.parse(body);

          const dlqId = params.id;
          const deadLetter = await getDeadLetter(context.repository, dlqId);
          const beforeState = { ...deadLetter };

          const result = await retryDeadLetter(context.repository, dlqId);

          const supportId = recordAdminMutationAudit({
            actor: context.principal!.address,
            action: "dlq.retry",
            target: `dlq:${dlqId}`,
            reason: parsed.reason,
            beforeState,
            afterState: result.deadLetter,
            requestId: context.requestId || "",
            result: "success",
          });

          return apiSuccess(request, { ...result, supportId });
        }),
    },
  },
});
