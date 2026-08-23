import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { createDraft, listDrafts } from "@/server/api/draft-service";
import { getApiContext } from "@/server/api/context";
import { draftCreateSchema } from "@/server/api/domain";
import { parseJsonBody, parseSearchParams } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

import { draftListQuerySchema } from "./-_schemas";

export const Route = createFileRoute("/api/v1/drafts/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = requireActor(context);
          const query = parseSearchParams(request, draftListQuerySchema);
          const result = await listDrafts(context.repository, owner, {
            limit: query.limit,
            after: query.cursor,
          });
          return apiSuccess(request, result);
        }),
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = requireActor(context);
          const body = await parseJsonBody(request, draftCreateSchema, {
            route: "POST /drafts",
          });
          const result = await createDraft(context.repository, owner, body);
          return apiSuccess(request, result, { status: 201 });
        }),
    },
  },
});
