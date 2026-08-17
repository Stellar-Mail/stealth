import { createFileRoute } from "@tanstack/react-router";

import { getRelayService } from "@/services/relay/context";
import { handleRelayHealth } from "@/services/relay/transport";

export const Route = createFileRoute("/api/v1/relay/health")({
  server: {
    handlers: {
      GET: async ({ request }) => handleRelayHealth(request, await getRelayService()),
    },
  },
});
