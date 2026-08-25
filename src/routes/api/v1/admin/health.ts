import { createFileRoute } from "@tanstack/react-router";

import { getApiContext } from "@/server/api/context";
import { checkApiReadiness } from "@/server/api/health";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { requireAdminRole } from "@/server/api/authorization/admin";
import { getVersionInfo } from "@/server/api/version";

export const Route = createFileRoute("/api/v1/admin/health")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const readiness = await checkApiReadiness();

          return apiSuccess(request, {
            status: readiness.ready ? "healthy" : "unhealthy",
            ready: readiness.ready,
            dependencies: readiness.dependencies,
            environment: import.meta.env.MODE,
            service: "stealth-mail-api",
            version: "v1",
            versions: getVersionInfo(),
            timestamp: new Date().toISOString(),
          });
        }),
    },
  },
});
