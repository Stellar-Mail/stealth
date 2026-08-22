import handler from "@tanstack/react-start/server-entry";

import { handleApiRequest } from "./server/api/response";
import { getApiContext, getObjectStore } from "./server/api/context";
import { enforceRetention } from "./server/api/retention-service";
import { applySecurityHeaders } from "./server/security/headers";

export { StealthCoordinator } from "./server/api/stealth-coordinator";

export default {
  async fetch(...args: Parameters<typeof handler.fetch>) {
    const [request] = args;
    let response: Response;
    if (request.method === "OPTIONS" && new URL(request.url).pathname.startsWith("/api/")) {
      response = await handleApiRequest(request, () => handler.fetch(...args));
    } else {
      response = await handler.fetch(...args);
    }
    return applySecurityHeaders(response);
  },
  async scheduled(controller: { scheduledTime: number }) {
    const context = await getApiContext();
    await enforceRetention(
      context.repository,
      await getObjectStore(),
      new Date(controller.scheduledTime),
    );
  },
};
