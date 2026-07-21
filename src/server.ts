import handler from "@tanstack/react-start/server-entry";

import { handleApiRequest } from "./server/api/response";

export { StealthCoordinator } from "./server/api/stealth-coordinator";

export default {
  async fetch(...args: Parameters<typeof handler.fetch>) {
    const [request] = args;
    if (request.method === "OPTIONS" && new URL(request.url).pathname.startsWith("/api/")) {
      return handleApiRequest(request, () => handler.fetch(...args));
    }
    return handler.fetch(...args);
  },
};
