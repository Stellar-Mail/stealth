import { createFileRoute } from "@tanstack/react-router";
import { getApiContext } from "@/server/api/context";
import { requireActor } from "@/server/api/actor";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { stellarAddressSchema } from "@/server/api/domain";
import { publishKeyRequestSchema } from "@/features/identity/keys";
import { getKeyDirectory, publishKey } from "@/server/api/key-directory-service";
import { ApiError } from "@/server/api/errors";

export const Route = createFileRoute("/api/v1/identity/keys/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const url = new URL(request.url);
          const ownerParam =
            url.searchParams.get("owner") || request.headers.get("x-stealth-address");
          if (!ownerParam) {
            throw new ApiError(400, "bad_request", "Missing required 'owner' parameter");
          }
          const owner = stellarAddressSchema.parse(ownerParam);
          const directory = await getKeyDirectory(context.repository, owner);
          return apiSuccess(request, directory);
        }),
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const body = await parseJsonBody(request, publishKeyRequestSchema, {
            route: "POST /identity/keys",
          });
          const result = await publishKey(context.repository, actor, body);
          return apiSuccess(request, result, { status: 201 });
        }),
    },
  },
});
