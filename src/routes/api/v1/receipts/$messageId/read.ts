import { createFileRoute } from "@tanstack/react-router";

import { requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema } from "@/server/api/domain";
import { getReceipt, markReceiptReadFrom } from "@/server/api/receipt-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/receipts/$messageId/read")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const repository = getApiContext().repository;
          const messageId = hash32Schema.parse(params.messageId);
          const current = await getReceipt(repository, messageId);
          requireActorMatches(request, current.recipient);
          const receipt = await markReceiptReadFrom(repository, current);
          return apiSuccess(request, receipt);
        }),
    },
  },
});
