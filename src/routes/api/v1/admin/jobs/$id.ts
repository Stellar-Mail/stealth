import { createFileRoute } from "@tanstack/react-router";
import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/admin/jobs/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const job = await context.repository.getJob(params.id);
          if (!job) {
            throw new ApiError(404, "not_found", `Job ${params.id} was not found`);
          }
          return apiSuccess(request, { job });
        }),
    },
  },
});
