import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { createRecoveryMethod } from "@/server/api/device-service";
import { recoveryMethodCreateSchema } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/devices/recovery-methods")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const address = requireActor(request);
          const methods = await getApiContext().repository.listRecoveryMethods(address);
          return apiSuccess(request, { methods });
        }),
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const address = requireActor(request);
          const data = await parseJsonBody(request, recoveryMethodCreateSchema);
          const method = await createRecoveryMethod(getApiContext().repository, address, data);
          return apiSuccess(request, { method });
        }),
    },
  },
});
