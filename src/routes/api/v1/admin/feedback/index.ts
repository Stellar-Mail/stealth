import { createFileRoute } from "@tanstack/react-router";

import { requireAdminRole } from "@/server/api/authorization/admin";
import { getApiContext } from "@/server/api/context";
import {
  feedbackWorkflowFilterSchema,
  listFeedbackForOperators,
} from "@/server/api/feedback-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/admin/feedback/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);
          const url = new URL(request.url);
          const filter = feedbackWorkflowFilterSchema().parse({
            status: url.searchParams.get("status") || undefined,
            category: url.searchParams.get("category") || undefined,
            severity: url.searchParams.get("severity") || undefined,
            limit: url.searchParams.get("limit") || undefined,
          });
          const reports = await listFeedbackForOperators(context.repository, filter);
          return apiSuccess(request, { reports });
        }),
    },
  },
});
