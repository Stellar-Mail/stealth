import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema, stellarAddressSchema } from "@/server/api/domain";
import { SendCoordinator } from "@/server/api/send-coordinator";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { withIdempotency } from "@/server/api/idempotency-service";

const coordinateActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    messageId: hash32Schema,
    sender: stellarAddressSchema,
    recipient: stellarAddressSchema,
    recipientDomain: z.string().optional(),
  }),
  z.object({
    action: z.literal("get"),
    messageId: hash32Schema,
    sender: stellarAddressSchema,
  }),
  z.object({
    action: z.literal("quote"),
    messageId: hash32Schema,
    sender: stellarAddressSchema,
    recipient: stellarAddressSchema,
  }),
  z.object({
    action: z.literal("reconcile"),
    messageId: hash32Schema,
    sender: stellarAddressSchema,
  }),
  z.object({
    action: z.literal("resume"),
    messageId: hash32Schema,
    sender: stellarAddressSchema,
  }),
]);

export const Route = createFileRoute("/api/v1/send/coordinate")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const input = await parseJsonBody(request, coordinateActionSchema, {
            route: "POST /send/coordinate",
          });
          requireActorMatches(apiContext, input.sender);

          const coordinator = new SendCoordinator();
          const rawIdempotencyKey = request.headers.get("x-idempotency-key");

          const execute = async () => {
            switch (input.action) {
              case "create": {
                const state = await coordinator.createOperation(apiContext, {
                  messageId: input.messageId,
                  sender: input.sender,
                  recipient: input.recipient,
                  recipientDomain: input.recipientDomain,
                });
                return { status: 201, body: { state } };
              }
              case "get": {
                const state = await coordinator.getOperation(apiContext, input.messageId);
                return { status: 200, body: { state } };
              }
              case "quote": {
                const res = await coordinator.requestQuote(apiContext, {
                  messageId: input.messageId,
                  sender: input.sender,
                  recipient: input.recipient,
                });
                return { status: 200, body: res };
              }
              case "reconcile": {
                const state = await coordinator.reconcileOperation(apiContext, input.messageId);
                return { status: 200, body: { state } };
              }
              case "resume": {
                const state = await coordinator.resumeOperation(apiContext, input.messageId);
                return { status: 200, body: { state } };
              }
            }
          };

          const result = rawIdempotencyKey
            ? await withIdempotency(
                apiContext.repository,
                {
                  actor: input.sender,
                  method: request.method,
                  route: "POST /send/coordinate",
                  rawKey: rawIdempotencyKey,
                },
                input,
                execute,
              )
            : { ...(await execute()), replayed: false };

          return apiSuccess(request, result.body, {
            status: result.status,
            ...(result.replayed ? { headers: { "x-idempotency-replayed": "true" } } : {}),
          });
        }),
    },
  },
});
