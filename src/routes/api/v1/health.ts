import { createFileRoute } from "@tanstack/react-router";

import { checkApiReadiness } from "@/server/api/health";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

function requestedCheck(request: Request) {
  return new URL(request.url).searchParams.get("check") === "readiness" ? "readiness" : "liveness";
}

export const Route = createFileRoute("/api/v1/health")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const check = requestedCheck(request);

          if (check === "readiness") {
            const readiness = await checkApiReadiness();
            return apiSuccess(
              request,
              {
                check,
                dependencies: readiness.dependencies,
                environment: import.meta.env.MODE,
                service: "stealth-mail-api",
                status: readiness.ready ? "ready" : "not_ready",
                timeoutMs: readiness.timeoutMs,
                version: "v1",
              },
              { status: readiness.ready ? 200 : 503 },
            );
          }

          return apiSuccess(request, {
            check,
            environment: import.meta.env.MODE,
            service: "stealth-mail-api",
            status: "ok",
            version: "v1",
          });
        }),
    },
  },
});
