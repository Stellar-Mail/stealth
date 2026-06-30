import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { ApiError } from "@/server/api/errors";

export const Route = createFileRoute("/api/v1/devices/$deviceId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const address = requireActor(request);
          const device = await getApiContext().repository.getDevice(params.deviceId);
          if (!device || device.address !== address) {
            throw new ApiError(404, "not_found", "Device not found");
          }
          return apiSuccess(request, { device });
        }),
    },
  },
});
