import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { loadRuntimeConfig } from "@/config";
import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema, stellarAddressSchema } from "@/server/api/domain";
import {
  anchorLifecycle,
  assertLifecycleParticipant,
  buildLifecycleChainAdapter,
  scheduleLifecycleAnchor,
} from "@/server/api/lifecycle-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const anchorSchema = z.object({
  sender: stellarAddressSchema,
  recipient: stellarAddressSchema,
  verified: z.boolean().optional(),
  receiptRequired: z.boolean().optional(),
});

export const Route = createFileRoute("/api/v1/lifecycle/$messageId/anchor")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const messageId = hash32Schema.parse(params.messageId);
          const input = await parseJsonBody(request, anchorSchema, {
            route: "POST /lifecycle/{messageId}/anchor",
          });
          const actor = requireActor(context);

          // Only a message participant may anchor its lifecycle.
          assertLifecycleParticipant(input, actor);

          const postage = await context.repository.getPostage(messageId);
          await scheduleLifecycleAnchor(context.repository, {
            messageId,
            sender: input.sender,
            recipient: input.recipient,
            amount: postage?.amount ?? "0",
            verified: input.verified ?? false,
            receiptRequired: input.receiptRequired ?? false,
          });

          const adapter = buildLifecycleChainAdapter(loadRuntimeConfig());
          const anchor = await anchorLifecycle(context.repository, adapter, messageId);
          return apiSuccess(request, anchor, { status: 202 });
        }),
    },
  },
});
