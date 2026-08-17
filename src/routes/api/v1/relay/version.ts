import { createFileRoute } from "@tanstack/react-router";

import { getRelayService } from "@/services/relay/context";
import { handleRelayVersion } from "@/services/relay/transport";

export const Route = createFileRoute("/api/v1/relay/version")({
  server: {
    handlers: {
      GET: async ({ request }) => handleRelayVersion(request, await getRelayService()),
    },
  },
});
