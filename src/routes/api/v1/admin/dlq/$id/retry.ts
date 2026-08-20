import { createFileRoute } from "@tanstack/react-router";
import { getApiContext } from "@/server/api/context";
import { retryDeadLetter } from "@/server/api/job-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/admin/dlq/$id/retry")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const result = await retryDeadLetter(context.repository, params.id);
          return apiSuccess(request, result);
        }),
    },
  },
});
