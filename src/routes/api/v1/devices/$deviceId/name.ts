import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { renameDevice } from "@/server/api/device-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const nameSchema = z.object({
  name: z.string().min(1).max(64),
});

export const Route = createFileRoute("/api/v1/devices/$deviceId/name")({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const address = requireActor(request);
          const { name } = await parseJsonBody(request, nameSchema);
          const device = await renameDevice(
            getApiContext().repository,
            params.deviceId,
            address,
            name,
          );
          return apiSuccess(request, { device });
        }),
    },
  },
});
