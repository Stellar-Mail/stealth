import { createFileRoute } from "@tanstack/react-router";

import { getRelayService } from "@/services/relay/context";
import { handleRelaySubmit } from "@/services/relay/transport";

export const Route = createFileRoute("/api/v1/relay/messages")({
  server: {
    handlers: {
      POST: async ({ request }) => handleRelaySubmit(request, await getRelayService()),
    },
  },
});
