import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { toggleDeviceTrust } from "@/server/api/device-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const trustSchema = z.object({
  trusted: z.boolean(),
});

export const Route = createFileRoute("/api/v1/devices/$deviceId/trust")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const address = requireActor(request);
          const { trusted } = await parseJsonBody(request, trustSchema);
          const device = await toggleDeviceTrust(
            getApiContext().repository,
            params.deviceId,
            address,
            trusted,
          );
          return apiSuccess(request, { device });
        }),
    },
  },
});
