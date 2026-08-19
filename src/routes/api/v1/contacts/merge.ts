import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { mergeContacts } from "@/server/api/contact-service";
import { getApiContext } from "@/server/api/context";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

import { contactMergeSchema } from "./-_schemas";

export const Route = createFileRoute("/api/v1/contacts/merge")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = requireActor(context);
          const body = await parseJsonBody(request, contactMergeSchema, {
            route: "POST /contacts/merge",
          });
          const result = await mergeContacts(context.repository, owner, body);
          return apiSuccess(request, result);
        }),
    },
  },
});
