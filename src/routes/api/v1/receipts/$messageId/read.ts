import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";

import { requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema } from "@/server/api/domain";
import { ApiError } from "@/server/api/errors";
import { getReceipt, markReceiptRead } from "@/server/api/receipt-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const payloadSchema = z.object({
  readAt: z.string().datetime(),
});

export const Route = createFileRoute("/api/v1/receipts/$messageId/read")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const repository = getApiContext().repository;
          const messageId = hash32Schema.parse(params.messageId);

          const payload = await parseJsonBody(request, payloadSchema);
          const readAt = new Date(payload.readAt);

          const current = await getReceipt(repository, messageId);
          requireActorMatches(request, current.recipient);

          if (readAt.getTime() < new Date(current.deliveredAt).getTime()) {
            throw new ApiError(
              400,
              "bad_request",
              "Read timestamp cannot be before delivery timestamp",
            );
          }

          const receipt = await markReceiptRead(repository, messageId, readAt);
          return apiSuccess(request, receipt);
        }),
    },
  },
});
