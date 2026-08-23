import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import {
  encryptedMessageReferenceSchema,
  stellarAddressSchema,
  unknownSenderRequestSchema,
} from "@/server/api/domain";
import { parseJsonBody, parseSearchParams } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { createSenderRequest } from "@/server/api/sender-request-service";
import { ApiError } from "@/server/api/errors";
import { encodeCursor, decodeCursor } from "@/server/api/pagination";

const createRequestBodySchema = z.object({
  requestId: z.string().uuid(),
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
  message: encryptedMessageReferenceSchema,
  expiresAt: z.string().datetime(),
});

const requestsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().default(25),
});

export const Route = createFileRoute("/api/v1/requests/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const query = parseSearchParams(request, requestsQuerySchema);

          let afterKey: string | undefined;
          if (query.cursor) {
            const decoded = decodeCursor(query.cursor, actor, "sender_requests");
            afterKey = decoded.continuationKey;
          }

          const requests = await context.repository.listSenderRequests(actor, "pending");

          // Enrich requests with age/creation, verified status, postage, and proof summary
          const enriched = await Promise.all(
            requests.map(async (req) => {
              const messageId = req.message.messageId;
              const postage = await context.repository.getPostage(messageId);
              const anchor = await context.repository.getLifecycleAnchor(messageId);
              return {
                ...req,
                postageAmount: postage?.amount ?? "0",
                verifiedSender: anchor?.verified ?? false,
                proofSummary: postage
                  ? `Payment hash: ${postage.paymentHash.slice(0, 10)}... Status: ${postage.status}`
                  : "No postage proof",
              };
            }),
          );

          const { paginate, declareOrdering } = await import("@/server/api/repository");
          const spec = declareOrdering<any>(
            [{ field: "createdAt", direction: "desc" }],
            "requestId",
          );
          const page = paginate(enriched, spec, { limit: query.limit ?? 25, after: afterKey });

          const hasMore = Boolean(page.nextContinuationKey);
          const nextCursor = page.nextContinuationKey
            ? encodeCursor(actor, page.nextContinuationKey, "sender_requests")
            : null;

          return apiSuccess(request, {
            items: page.items,
            nextCursor,
            hasMore,
          });
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
