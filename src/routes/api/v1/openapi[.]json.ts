import { createFileRoute } from "@tanstack/react-router";

import { openApiDocument } from "@/server/api/openapi";
import { jsonResponse } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/openapi.json")({
  server: {
    handlers: {
      GET: ({ request }) =>
        jsonResponse(request, openApiDocument, {
          cachePolicy: "PUBLIC_5_MINUTES",
        }),
    },
  },
});
