import { createFileRoute } from "@tanstack/react-router";

import { getRelayService } from "@/services/relay/context";
import { handleRelayReadiness } from "@/services/relay/transport";

export const Route = createFileRoute("/api/v1/relay/readiness")({
  server: {
    handlers: {
      GET: async ({ request }) => handleRelayReadiness(request, await getRelayService()),
    },
  },
});
