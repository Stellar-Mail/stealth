import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema } from "@/server/api/domain";
import { getReceipt, markReceiptRead } from "@/server/api/receipt-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

import { assertCanPublishReadReceipt } from "../-authorization";

export const Route = createFileRoute("/api/v1/receipts/$messageId/read")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const repository = (await getApiContext()).repository;
          const messageId = hash32Schema.parse(params.messageId);
          const current = await getReceipt(repository, messageId);
          const principal = requireActor(request);
          assertCanPublishReadReceipt(principal, current);
          const receipt = await markReceiptRead(repository, messageId);
          return apiSuccess(request, receipt);
        }),
    },
  },
});
