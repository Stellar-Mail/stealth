import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getApiContext } from "@/server/api/context";
import { durableJobTypeSchema, deadLetterStatusSchema } from "@/server/api/domain";
import { listDeadLetters } from "@/server/api/job-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { requireAdminRole } from "@/server/api/authorization/admin";

const querySchema = z.object({
  jobType: durableJobTypeSchema.optional(),
  status: deadLetterStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const Route = createFileRoute("/api/v1/admin/dlq/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const url = new URL(request.url);
          const parsed = querySchema.parse({
            jobType: url.searchParams.get("jobType") || undefined,
            status: url.searchParams.get("status") || undefined,
            limit: url.searchParams.get("limit") || undefined,
          });

          const deadLetters = await listDeadLetters(context.repository, parsed);
          return apiSuccess(request, { deadLetters });
        }),
    },
  },
});
