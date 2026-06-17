import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { getDevicesWithSessions } from "@/server/api/device-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/devices/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const address = requireActor(request);
          const fingerprint = request.headers.get("x-device-fingerprint") ?? undefined;
          const devices = await getDevicesWithSessions(
            getApiContext().repository,
            address,
            fingerprint,
          );
          return apiSuccess(request, { devices });
        }),
    },
  },
});
