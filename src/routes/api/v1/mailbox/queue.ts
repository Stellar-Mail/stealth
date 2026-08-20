import { createFileRoute } from "@tanstack/react-router";

import { requireActor, requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { mailboxQueueQuerySchema, type MailboxDescriptor } from "@/server/api/domain";
import { encodeCursor, decodeCursor } from "@/server/api/pagination";
import { parseSearchParams } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/mailbox/queue")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const actor = requireActor(apiContext);

          const query = parseSearchParams(request, mailboxQueueQuerySchema);

          if (query.recipient && query.recipient !== actor) {
            requireActorMatches(apiContext, query.recipient);
          }

          let afterKey: string | undefined;
          if (query.cursor) {
            const decoded = decodeCursor(query.cursor, actor, "mailbox_queue");
            afterKey = decoded.continuationKey;
          }

          const page = await apiContext.repository.listRecipientEnvelopes(actor, {
            status: query.status,
            includeTombstones: query.includeTombstones,
            limit: query.limit,
            after: afterKey,
          });

          const items: MailboxDescriptor[] = page.items.map((item) => ({
            messageId: item.messageId,
            senderId: item.senderId,
            recipientId: item.recipientId,
            status: item.status ?? "pending",
            createdAt: item.createdAt,
            protectedHeaders: item.protectedHeaders,
            contentCommitment: item.contentCommitment,
            objectRef: item.objectRef,
            isTombstone: Boolean(item.deletedAt),
            deletedAt: item.deletedAt ?? null,
          }));

          const hasMore = Boolean(page.nextContinuationKey);
          const nextCursor = page.nextContinuationKey
            ? encodeCursor(actor, page.nextContinuationKey, "mailbox_queue")
            : null;

          return apiSuccess(
            request,
            {
              items,
              nextCursor,
              hasMore,
            },
            { status: 200 },
          );
        }),
    },
  },
});
