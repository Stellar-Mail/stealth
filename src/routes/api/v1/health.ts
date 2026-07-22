import { createFileRoute } from "@tanstack/react-router";

import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { getVersionInfo } from "@/server/api/version";

export const Route = createFileRoute("/api/v1/health")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, () =>
          apiSuccess(request, {
            environment: import.meta.env.MODE,
            service: "stealth-mail-api",
            status: "ok",
            version: "v1",
            versions: getVersionInfo(),
          }),
        ),
    },
  },
});
