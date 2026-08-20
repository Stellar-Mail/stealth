import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { previewContactImport } from "@/server/api/contact-service";
import { getApiContext } from "@/server/api/context";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

import { importPreviewSchema } from "../-_schemas";

export const Route = createFileRoute("/api/v1/contacts/import/preview")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = requireActor(context);
          const body = await parseJsonBody(request, importPreviewSchema, {
            route: "POST /contacts/import/preview",
          });
          const result = await previewContactImport(context.repository, owner, body);
          return apiSuccess(request, result);
        }),
    },
  },
});
