import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { unknownSenderDecisionSchema } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { decideSenderRequest } from "@/server/api/sender-request-service";

const decisionBodySchema = z.object({ decision: unknownSenderDecisionSchema });

export const Route = createFileRoute(`/api/v1/requests/$requestId/decisions`)({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const { decision } = await parseJsonBody(request, decisionBodySchema, {
            route: "POST /requests/{requestId}/decisions",
          });
          return apiSuccess(
            request,
            await decideSenderRequest(context.repository, params.requestId, actor, decision),
          );
        }),
    },
  },
});
