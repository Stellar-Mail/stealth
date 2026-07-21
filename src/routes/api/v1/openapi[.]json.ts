import { createFileRoute } from "@tanstack/react-router";

import { openApiDocument } from "@/server/api/openapi";
import { methodGuard } from "@/server/api/methodGuard";

export const Route = createFileRoute("/api/v1/openapi.json")({
  server: {
    handlers: methodGuard({
      GET: () =>
        new Response(JSON.stringify(openApiDocument), {
          headers: {
            "cache-control": "public, max-age=300",
            "content-type": "application/json; charset=utf-8",
          },
        }),
    }),
  },
});
