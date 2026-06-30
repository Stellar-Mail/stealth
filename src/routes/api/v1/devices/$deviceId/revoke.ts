import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { revokeDevice } from "@/server/api/device-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/devices/$deviceId/revoke")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const address = requireActor(request);
          await revokeDevice(getApiContext().repository, params.deviceId, address);
          return apiSuccess(request, { success: true });
        }),
    },
  },
});
