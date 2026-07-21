import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema, stellarAddressSchema } from "@/server/api/domain";
import { createDeliveryReceipt } from "@/server/api/receipt-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

import { assertCanPublishDeliveryReceipt } from "./-authorization";

const deliverySchema = z.object({
  messageId: hash32Schema,
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
});

export const Route = createFileRoute("/api/v1/receipts/")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const input = await parseJsonBody(request, deliverySchema);
          const principal = requireActor(request);
          assertCanPublishDeliveryReceipt(principal, input);
          const receipt = await createDeliveryReceipt((await getApiContext()).repository, input);
          return apiSuccess(request, receipt, { status: 201 });
        }),
    },
  },
});
