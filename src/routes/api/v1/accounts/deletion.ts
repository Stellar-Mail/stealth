// BETA-080 (Issue #1987): request account deletion with a cooling-off period.
import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { requestAccountDeletion } from "@/server/api/account-data-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/accounts/deletion")({
  server: {
    handlers: {
      DELETE: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const deletion = await requestAccountDeletion(context.repository, actor);
          return apiSuccess(request, deletion, { status: 202 });
        }),
    },
  },
});
