import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getApiContext } from "@/server/api/context";
import { abandonDeadLetter, getDeadLetter } from "@/server/api/job-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  requireAdminRole,
  recordAdminMutationAudit,
  adminMutationSchema,
} from "@/server/api/authorization/admin";

const abandonSchema = adminMutationSchema.extend({
  adminNotes: z.string().max(500).optional(),
});

export const Route = createFileRoute("/api/v1/admin/dlq/$id/abandon")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const body = await request.json();
          const parsed = abandonSchema.parse(body);

          const dlqId = params.id;
          const deadLetter = await getDeadLetter(context.repository, dlqId);
          const beforeState = { ...deadLetter };

          const result = await abandonDeadLetter(context.repository, dlqId, parsed.adminNotes);

          const supportId = recordAdminMutationAudit({
            actor: context.principal!.address,
            action: "dlq.abandon",
            target: `dlq:${dlqId}`,
            reason: parsed.reason,
            beforeState,
            afterState: result,
            requestId: context.requestId || "",
            result: "success",
          });

          return apiSuccess(request, { deadLetter: result, supportId });
        }),
    },
  },
});
