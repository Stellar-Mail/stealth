import { createFileRoute } from "@tanstack/react-router";

import { getMailboxSyncService } from "@/services/relay/context";
import { handleMailboxSync } from "@/services/relay/mailbox-sync-transport";

export const Route = createFileRoute("/api/v1/mailbox/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMailboxSync(request, await getMailboxSyncService()),
    },
  },
});
