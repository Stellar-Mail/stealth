import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { countMailbox, listAllRecipientEnvelopes } from "@/server/api/mailbox-live";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/mailbox/counts")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const actor = requireActor(apiContext);
          const envelopes = await listAllRecipientEnvelopes(apiContext.repository, actor, true);
          return apiSuccess(request, { counts: countMailbox(envelopes) }, { status: 200 });
        }),
    },
  },
});
