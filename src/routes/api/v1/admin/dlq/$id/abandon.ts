import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getApiContext } from "@/server/api/context";
import { abandonDeadLetter } from "@/server/api/job-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { parseJsonBody } from "@/server/api/request";

const abandonBodySchema = z.object({
  adminNotes: z.string().max(500).optional(),
});

export const Route = createFileRoute("/api/v1/admin/dlq/$id/abandon")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          let adminNotes: string | undefined;
          try {
            const body = await parseJsonBody(request, abandonBodySchema);
            adminNotes = body.adminNotes;
          } catch {
            // Optional body
          }

          const deadLetter = await abandonDeadLetter(context.repository, params.id, adminNotes);
          return apiSuccess(request, { deadLetter });
        }),
    },
  },
});
