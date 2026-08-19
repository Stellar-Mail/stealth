import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema } from "@/server/api/domain";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/mailbox/$messageId")({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const actor = requireActor(apiContext);
          const messageId = hash32Schema.parse(params.messageId);

          const tombstoned = await apiContext.repository.tombstoneEnvelope(messageId, actor);

          return apiSuccess(
            request,
            {
              messageId: tombstoned.messageId,
              status: tombstoned.status ?? "pending",
              isTombstone: true,
              deletedAt: tombstoned.deletedAt,
            },
            { status: 200 },
          );
        }),
    },
  },
});
