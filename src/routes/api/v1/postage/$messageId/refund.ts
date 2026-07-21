import { createFileRoute } from "@tanstack/react-router";

import { assertActorMatches, requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema } from "@/server/api/domain";
import { getPostage, resolvePostage } from "@/server/api/postage-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/postage/$messageId/refund")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const repository = (await getApiContext()).repository;
          // Authenticate before loading so unauthenticated callers cannot
          // probe whether a message id exists.
          const actor = await requireActor(request);
          const messageId = hash32Schema.parse(params.messageId);
          const current = await getPostage(repository, messageId);
          assertActorMatches(actor, current.recipient);
          const postage = await resolvePostage(repository, messageId, "refunded");
          return apiSuccess(request, postage);
        }),
    },
  },
});
