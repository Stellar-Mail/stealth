import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/attachments/$attachmentId/meta")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const actor = requireActor(request);
          const { attachmentId } = params;

          const storage = getApiContext().repository.getAttachmentStorage();
          const session = await storage.getSession(attachmentId, actor);

          return apiSuccess(request, session);
        }),
    },
  },
});
