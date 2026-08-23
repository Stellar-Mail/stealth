import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { commitContactImport } from "@/server/api/contact-service";
import { getApiContext } from "@/server/api/context";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

import { importCommitSchema } from "../-_schemas";

export const Route = createFileRoute("/api/v1/contacts/import/commit")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = requireActor(context);
          const body = await parseJsonBody(request, importCommitSchema, {
            route: "POST /contacts/import/commit",
          });
          const result = await commitContactImport(context.repository, owner, body);
          return apiSuccess(request, result, { status: 201 });
        }),
    },
  },
});
