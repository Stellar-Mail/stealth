import { createFileRoute } from "@tanstack/react-router";

import { openApiDocument } from "@/server/api/openapi";
import { handleApiRequest, jsonResponse } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/openapi.json")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, () =>
          jsonResponse(request, openApiDocument, {
            cachePolicy: "PUBLIC_5_MINUTES",
          }),
        ),
    },
  },
});
