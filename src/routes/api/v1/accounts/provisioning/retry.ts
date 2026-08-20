import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { retryAccountProvisioning } from "@/server/api/account-provisioning";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { ApiError } from "@/server/api/errors";

export const Route = createFileRoute("/api/v1/accounts/provisioning/retry")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const address = requireActor(context);

          // Owner-scoped retry control: only the account owner may restart a
          // failed provisioning flow for their own account.
          const user = await context.repository.getUserByAddress(address);
          if (!user) {
            throw new ApiError(404, "not_found", "No account exists for this address");
          }

          const progress = await retryAccountProvisioning(context.repository, user.userId);
          return apiSuccess(request, progress);
        }),
    },
  },
});
