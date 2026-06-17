import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { flagDeviceCompromised } from "@/server/api/device-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/devices/$deviceId/compromised")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const address = requireActor(request);
          await flagDeviceCompromised(getApiContext().repository, params.deviceId, address);
          return apiSuccess(request, { success: true });
        }),
    },
  },
});
