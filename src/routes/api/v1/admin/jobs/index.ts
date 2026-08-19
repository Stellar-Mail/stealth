import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getApiContext } from "@/server/api/context";
import { durableJobTypeSchema, jobStatusSchema } from "@/server/api/domain";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const querySchema = z.object({
  type: durableJobTypeSchema.optional(),
  status: jobStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const Route = createFileRoute("/api/v1/admin/jobs/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const url = new URL(request.url);
          const parsed = querySchema.parse({
            type: url.searchParams.get("type") || undefined,
            status: url.searchParams.get("status") || undefined,
            limit: url.searchParams.get("limit") || undefined,
          });

          const jobs = await context.repository.listJobs(parsed);
          return apiSuccess(request, { jobs });
        }),
    },
  },
});
