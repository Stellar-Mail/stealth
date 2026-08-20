import { createFileRoute } from "@tanstack/react-router";
import { getApiContext } from "@/server/api/context";
import { requireActor } from "@/server/api/actor";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { rotateKeyRequestSchema } from "@/features/identity/keys";
import { rotateKey } from "@/server/api/key-directory-service";

export const Route = createFileRoute("/api/v1/identity/keys/rotate")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const body = await parseJsonBody(request, rotateKeyRequestSchema, {
            route: "POST /identity/keys/rotate",
          });
          const result = await rotateKey(context.repository, actor, body);
          return apiSuccess(request, result);
        }),
    },
  },
});
