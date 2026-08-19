import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { getProvisioningProgress } from "@/server/api/account-provisioning";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { ApiError } from "@/server/api/errors";

export const Route = createFileRoute("/api/v1/accounts/provisioning")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const user = await context.repository.getUserByAddress(actor);
          if (!user) {
            throw new ApiError(404, "not_found", "No account exists for this address");
          }
          const provisioning = await getProvisioningProgress(context.repository, user.userId);
          if (!provisioning) {
            throw new ApiError(404, "not_found", "No provisioning record exists for this account");
          }
          // Safe projection: provisioning progress + account status only.
          // Never exposes credentials, wallet seeds, or hashes.
          return apiSuccess(request, {
            provisioning,
            accountStatus: user.status,
          });
        }),
    },
  },
});
