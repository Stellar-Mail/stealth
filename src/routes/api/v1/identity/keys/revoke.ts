import { createFileRoute } from "@tanstack/react-router";
import { getApiContext } from "@/server/api/context";
import { requireActor } from "@/server/api/actor";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { revokeKeyRequestSchema } from "@/features/identity/keys";
import { revokeKey } from "@/server/api/key-directory-service";

export const Route = createFileRoute("/api/v1/identity/keys/revoke")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const body = await parseJsonBody(request, revokeKeyRequestSchema, {
            route: "POST /identity/keys/revoke",
          });
          const result = await revokeKey(context.repository, actor, body);
          return apiSuccess(request, result);
        }),
    },
  },
});
