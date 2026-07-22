import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema } from "@/server/api/domain";
import { assertPostageParticipant, getPostage } from "@/server/api/postage-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/postage/$messageId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const messageId = hash32Schema.parse(params.messageId);
          const actor = requireActor(request);
          const postage = await getPostage((await getApiContext()).repository, messageId);
          assertPostageParticipant(postage, actor);
          return apiSuccess(request, postage);
        }),
    },
  },
});
