import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { deleteRecoveryMethod } from "@/server/api/device-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/devices/recovery-methods/$methodId")({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const address = requireActor(request);
          await deleteRecoveryMethod(getApiContext().repository, params.methodId, address);
          return apiSuccess(request, { success: true });
        }),
    },
  },
});
