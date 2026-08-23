// BETA-080 (Issue #1987): cancel deletion while the cooling-off period is open.
import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { cancelAccountDeletion } from "@/server/api/account-data-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/accounts/deletion-cancel")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const deletion = await cancelAccountDeletion(context.repository, actor);
          return apiSuccess(request, deletion);
        }),
    },
  },
});
