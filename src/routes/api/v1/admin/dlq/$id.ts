import { createFileRoute } from "@tanstack/react-router";
import { getApiContext } from "@/server/api/context";
import { getDeadLetter } from "@/server/api/job-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { requireAdminRole } from "@/server/api/authorization/admin";

export const Route = createFileRoute("/api/v1/admin/dlq/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const deadLetter = await getDeadLetter(context.repository, params.id);
          return apiSuccess(request, { deadLetter });
        }),
    },
  },
});
