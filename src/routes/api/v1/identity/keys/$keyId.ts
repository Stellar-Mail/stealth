import { createFileRoute } from "@tanstack/react-router";
import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { stellarAddressSchema } from "@/server/api/domain";
import { getKey } from "@/server/api/key-directory-service";
import { ApiError } from "@/server/api/errors";

export const Route = createFileRoute("/api/v1/identity/keys/$keyId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const url = new URL(request.url);
          const ownerParam =
            url.searchParams.get("owner") || request.headers.get("x-stealth-address");
          if (!ownerParam) {
            throw new ApiError(400, "bad_request", "Missing required 'owner' parameter");
          }
          const owner = stellarAddressSchema.parse(ownerParam);
          const key = await getKey(context.repository, owner, params.keyId);
          if (!key) {
            throw new ApiError(404, "not_found", `Key ${params.keyId} was not found`);
          }
          return apiSuccess(request, key);
        }),
    },
  },
});
