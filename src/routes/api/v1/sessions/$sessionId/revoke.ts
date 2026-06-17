import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { ApiError } from "@/server/api/errors";

export const Route = createFileRoute("/api/v1/sessions/$sessionId/revoke")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const address = requireActor(request);
          const repository = getApiContext().repository;
          const session = await repository.getSession(params.sessionId);
          if (!session) {
            throw new ApiError(404, "not_found", "Session not found");
          }
          if (session.address !== address) {
            throw new ApiError(403, "forbidden", "Cannot revoke another user's session");
          }
          const revoked = await repository.revokeSession(params.sessionId);
          return apiSuccess(request, { session: revoked });
        }),
    },
  },
});
