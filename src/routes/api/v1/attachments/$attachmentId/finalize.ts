import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const finalizeSchema = z.object({
  commitment: z.string().optional(),
});

export const Route = createFileRoute("/api/v1/attachments/$attachmentId/finalize")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const actor = requireActor(request);
          const attachmentId = params.attachmentId;

          let commitment: string | undefined;
          if (request.headers.get("content-type")?.includes("application/json")) {
            const body = await parseJsonBody(request, finalizeSchema);
            commitment = body.commitment;
          }

          const storage = getApiContext().repository.getAttachmentStorage();
          const session = await storage.finalizeSession(attachmentId, actor, commitment);

          return apiSuccess(request, session);
        }),
    },
  },
});
