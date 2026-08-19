import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { deleteContact, getContact, updateContact } from "@/server/api/contact-service";
import { getApiContext } from "@/server/api/context";
import { contactUpdateSchema } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/contacts/$contactId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = requireActor(context);
          const result = await getContact(context.repository, owner, params.contactId);
          return apiSuccess(request, result);
        }),
      PUT: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = requireActor(context);
          const body = await parseJsonBody(request, contactUpdateSchema, {
            route: "PUT /contacts/{contactId}",
          });
          const result = await updateContact(context.repository, owner, params.contactId, body);
          return apiSuccess(request, result);
        }),
      DELETE: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = requireActor(context);
          const result = await deleteContact(context.repository, owner, params.contactId);
          return apiSuccess(request, result);
        }),
    },
  },
});
