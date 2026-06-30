import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { rotateDeviceKeys } from "@/server/api/device-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const rotateKeysSchema = z.object({
  deviceIds: z.array(z.string()).min(1),
  newPublicKey: z.string().min(1).max(128),
});

export const Route = createFileRoute("/api/v1/devices/rotate-keys")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const address = requireActor(request);
          const { deviceIds, newPublicKey } = await parseJsonBody(request, rotateKeysSchema);
          const devices = await rotateDeviceKeys(
            getApiContext().repository,
            address,
            deviceIds,
            newPublicKey,
          );
          return apiSuccess(request, { devices });
        }),
    },
  },
});
