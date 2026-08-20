import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { getDeliveryState, transitionDeliveryState } from "@/server/api/delivery-service";
import { hash32Schema, messageDeliveryStateSchema } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const transitionRequestSchema = z.object({
  toState: messageDeliveryStateSchema,
  reason: z.string().min(1),
  chainReference: z.string().optional().nullable(),
});

export const Route = createFileRoute("/api/v1/delivery/$messageId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const messageId = hash32Schema.parse(params.messageId);
          requireActor(request);
          const repository = (await getApiContext()).repository;
          const status = await getDeliveryState(repository, messageId);
          return apiSuccess(request, status);
        }),
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const messageId = hash32Schema.parse(params.messageId);
          const actor = requireActor(request);
          const body = await parseJsonBody(request, transitionRequestSchema);
          const repository = (await getApiContext()).repository;
          const updatedStatus = await transitionDeliveryState(
            repository,
            messageId,
            body.toState,
            actor,
            body.reason,
            body.chainReference,
          );
          return apiSuccess(request, updatedStatus, { status: 200 });
        }),
    },
  },
});
