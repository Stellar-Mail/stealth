import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import {
  encryptedMessageReferenceSchema,
  stellarAddressSchema,
  unknownSenderRequestSchema,
} from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { createSenderRequest } from "@/server/api/sender-request-service";
import { ApiError } from "@/server/api/errors";

const createRequestBodySchema = z.object({
  requestId: z.string().uuid(),
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
  message: encryptedMessageReferenceSchema,
  expiresAt: z.string().datetime(),
});

export const Route = createFileRoute("/api/v1/requests/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          return apiSuccess(request, await context.repository.listSenderRequests(actor, "pending"));
        }),
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const input = await parseJsonBody(request, createRequestBodySchema, {
            route: "POST /requests",
          });
          if (input.sender !== actor) {
            throw new ApiError(
              403,
              "forbidden",
              "Authenticated sender does not match request sender",
            );
          }
          const result = await createSenderRequest(
            context.repository,
            unknownSenderRequestSchema.parse({
              ...input,
              createdAt: new Date().toISOString(),
              status: "pending",
            }),
          );
          return apiSuccess(request, result, { status: result.created ? 201 : 200 });
        }),
    },
  },
});
