import { createFileRoute } from "@tanstack/react-router";

import {
  assertDeliveryEventOperator,
  deliveryEventIngestSchema,
  ingestDeliveryEvent,
  toPublicDeliveryEventRecord,
} from "@/server/api/notification-delivery-events";
import { ApiError } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

/**
 * POST /api/v1/notifications/delivery-events
 *
 * BETA-091: Authenticated, provider-neutral DSN / bounce / complaint ingestion.
 * Requires `Authorization: Bearer <STEALTH_OPERATOR_SECRET>`.
 */
export const Route = createFileRoute("/api/v1/notifications/delivery-events")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          await assertDeliveryEventOperator(request);
          const input = await parseJsonBody(request, deliveryEventIngestSchema, {
            category: "minimal",
          });

          const result = ingestDeliveryEvent(input);
          if (!result.found || !result.record) {
            throw new ApiError(404, "not_found", "Unknown delivery messageId");
          }

          return apiSuccess(request, {
            event: toPublicDeliveryEventRecord(result.record),
          });
        }),
    },
  },
});
