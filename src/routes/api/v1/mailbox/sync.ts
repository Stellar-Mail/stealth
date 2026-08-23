import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { mailboxSyncQuerySchema } from "@/server/api/domain";
import { buildMailboxSync } from "@/server/api/mailbox-live";
import { parseSearchParams } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/mailbox/sync")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const actor = requireActor(apiContext);
          const query = parseSearchParams(request, mailboxSyncQuerySchema);
          const payload = await buildMailboxSync(apiContext.repository, actor, {
            ...query,
            limit: query.limit ?? 50,
          });
          return apiSuccess(request, payload, { status: 200 });
        }),
    },
  },
});
