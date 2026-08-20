import { createFileRoute } from "@tanstack/react-router";

import { enforceRelaySubmitLimits } from "@/server/api/abuse-controls";
import { getApiContext } from "@/server/api/context";
import { parseSessionCookie } from "@/server/api/auth/session-service";
import { getRelayService } from "@/services/relay/context";
import { handleRelaySubmit } from "@/services/relay/transport";

export const Route = createFileRoute("/api/v1/relay/messages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // BETA-049: enforce relay abuse controls before accepting messages
        const apiContext = await getApiContext(request);
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        const relayId = request.headers.get("x-stealth-relay-id") ?? "unknown";
        // Use session cookie if present, otherwise fall back to relay ID as session proxy
        const sessionId = parseSessionCookie(request.headers.get("cookie")) ?? `relay:${relayId}`;

        await enforceRelaySubmitLimits(apiContext.repository, ip, sessionId, relayId, request);

        return handleRelaySubmit(request, await getRelayService());
      },
    },
  },
});
