import { createFileRoute } from "@tanstack/react-router";

import { resolveIdentityRequestSchema } from "@/features/identity/types";
import { defaultIdentityResolver } from "@/features/identity/resolver";
import { getApiContext } from "@/server/api/context";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/identity/resolve")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const url = new URL(request.url);
          const identifier = url.searchParams.get("identifier") ?? "";
          const bypassCache = url.searchParams.get("bypassCache") === "true";
          const query = resolveIdentityRequestSchema.parse({
            identifier,
            bypassCache,
          });
          const context = await getApiContext(request);
          const result = await defaultIdentityResolver.resolve(query.identifier, {
            bypassCache: query.bypassCache,
            repository: context.repository,
          });
          return apiSuccess(request, result);
        }),
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const body = await parseJsonBody(request, resolveIdentityRequestSchema, "compact");
          const context = await getApiContext(request);
          const result = await defaultIdentityResolver.resolve(body.identifier, {
            timeoutMs: body.timeoutMs,
            bypassCache: body.bypassCache,
            repository: context.repository,
          });
          return apiSuccess(request, result);
        }),
    },
  },
});
