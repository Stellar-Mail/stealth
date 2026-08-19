/**
 * Mailbox sync HTTP transport (Issue #1941 BETA-034).
 *
 * Authenticated recipients pull incremental events after their last durable
 * cursor. The actor must own the mailbox; quarantined payloads are never
 * serialized into the response.
 */
import { requireActor } from "@/server/api/actor";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

import { MailboxSyncService } from "./mailbox-sync-service";
import { mailboxSyncRequestSchema } from "./mailbox-sync-types";

export function handleMailboxSync(request: Request, service: MailboxSyncService) {
  return handleApiRequest(request, async () => {
    const owner = requireActor(request);
    const input = await parseJsonBody(request, mailboxSyncRequestSchema, {
      route: "POST /mailbox/sync",
    });
    const result = await service.sync(owner, input);
    return apiSuccess(request, result, { status: 200 });
  });
}
