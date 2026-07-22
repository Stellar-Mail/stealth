import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema } from "@/server/api/domain";
import { assertReceiptParticipant, getReceipt } from "@/server/api/receipt-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/receipts/$messageId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const messageId = hash32Schema.parse(params.messageId);
          const actor = requireActor(request);
          const receipt = await getReceipt((await getApiContext()).repository, messageId);
          assertReceiptParticipant(receipt, actor);
          return apiSuccess(request, receipt);
        }),
    },
  },
});
