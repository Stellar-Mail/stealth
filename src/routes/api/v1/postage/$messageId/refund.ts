import { createFileRoute } from "@tanstack/react-router";

import { requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema } from "@/server/api/domain";
import { ApiError } from "@/server/api/errors";
import { getPostage } from "@/server/api/postage-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/postage/$messageId/refund")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const repository = getApiContext().repository;
          const messageId = hash32Schema.parse(params.messageId);
          const current = await getPostage(repository, messageId);
          requireActorMatches(request, current.recipient);
          if (current.status !== "pending") {
            throw new ApiError(409, "conflict", "Postage has already been resolved", {
              status: current.status,
            });
          }
          const postage = await repository.setPostage({ ...current, status: "refunded" });
          return apiSuccess(request, postage);
        }),
    },
  },
});
