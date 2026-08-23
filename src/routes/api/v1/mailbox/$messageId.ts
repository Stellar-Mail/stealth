import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema, mailboxFlagsPatchSchema } from "@/server/api/domain";
import {
  envelopeToMailboxDescriptor,
  envelopeToSealedMailboxMessage,
} from "@/server/api/mailbox-live";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { ApiError } from "@/server/api/errors";

export const Route = createFileRoute("/api/v1/mailbox/$messageId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const actor = requireActor(apiContext);
          const messageId = hash32Schema.parse(params.messageId);
          const envelope = await apiContext.repository.getEnvelope(messageId);
          if (!envelope) {
            throw new ApiError(404, "not_found", `No envelope found for message ${messageId}`);
          }
          if (envelope.recipientId.toUpperCase().trim() !== actor.toUpperCase().trim()) {
            throw new ApiError(403, "forbidden", "Cannot read another recipient's message");
          }
          return apiSuccess(request, envelopeToSealedMailboxMessage(envelope), { status: 200 });
        }),

      PATCH: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const actor = requireActor(apiContext);
          const messageId = hash32Schema.parse(params.messageId);
          const patch = await parseJsonBody(request, mailboxFlagsPatchSchema);
          const updated = await apiContext.repository.patchMailboxFlags(messageId, actor, patch);
          return apiSuccess(request, envelopeToMailboxDescriptor(updated), { status: 200 });
        }),

      DELETE: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const actor = requireActor(apiContext);
          const messageId = hash32Schema.parse(params.messageId);

          const tombstoned = await apiContext.repository.tombstoneEnvelope(messageId, actor);

          return apiSuccess(
            request,
            {
              messageId: tombstoned.messageId,
              status: tombstoned.status ?? "pending",
              isTombstone: true,
              deletedAt: tombstoned.deletedAt,
            },
            { status: 200 },
          );
        }),
    },
  },
});
