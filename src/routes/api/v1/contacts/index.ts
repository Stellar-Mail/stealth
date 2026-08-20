import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { createContact, listContacts } from "@/server/api/contact-service";
import { getApiContext } from "@/server/api/context";
import { contactCreateSchema } from "@/server/api/domain";
import { parseJsonBody, parseSearchParams } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

import { contactListQuerySchema } from "./-_schemas";

export const Route = createFileRoute("/api/v1/contacts/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = requireActor(context);
          const query = parseSearchParams(request, contactListQuerySchema);
          const result = await listContacts(context.repository, owner, {
            query: query.query,
            limit: query.limit,
            after: query.cursor,
          });
          return apiSuccess(request, result);
        }),
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = requireActor(context);
          const body = await parseJsonBody(request, contactCreateSchema, {
            route: "POST /contacts",
          });
          const result = await createContact(context.repository, owner, body);
          return apiSuccess(request, result, { status: 201 });
        }),
    },
  },
});
