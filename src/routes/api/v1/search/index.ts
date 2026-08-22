import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { parseSearchParams } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { searchMailboxService } from "@/server/api/search-service";

import { searchRouteQuerySchema } from "./-_schemas";

export const Route = createFileRoute("/api/v1/search/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const actor = requireActor(apiContext);

          const query = parseSearchParams(request, searchRouteQuerySchema);
          const result = await searchMailboxService(apiContext.repository, actor, query);

          return apiSuccess(request, result, { status: 200 });
        }),
    },
  },
});
