import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { deleteDraft, getDraft, updateDraft } from "@/server/api/draft-service";
import { getApiContext } from "@/server/api/context";
import { draftUpdateSchema } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/drafts/$draftId")({
  server: {
    handlers: {
      GET: ({ request, params }: any) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = requireActor(context);
          const result = await getDraft(context.repository, owner, params.draftId);
          return apiSuccess(request, result);
        }),
      PUT: ({ request, params }: any) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = requireActor(context);
          const body = await parseJsonBody(request, draftUpdateSchema, {
            route: "PUT /drafts/{draftId}",
          });
          const result = await updateDraft(
            context.repository,
            owner,
            params.draftId,
            body,
            body.expectedVersion,
          );
          return apiSuccess(request, result);
        }),
      DELETE: ({ request, params }: any) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = requireActor(context);
          await deleteDraft(context.repository, owner, params.draftId);
          return apiSuccess(request, { deleted: true });
        }),
    },
  },
});
