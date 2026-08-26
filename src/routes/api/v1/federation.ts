import { createFileRoute } from "@tanstack/react-router";
import { defaultIdentityResolver } from "@/features/identity/resolver";
import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/federation")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const url = new URL(request.url);
          const q = url.searchParams.get("q") ?? "";
          const type = url.searchParams.get("type") ?? "";

          if (!q || !type) {
            throw new ApiError(400, "bad_request", "Missing 'q' or 'type' parameter");
          }

          const context = await getApiContext(request);

          if (type === "name") {
            const result = await defaultIdentityResolver.resolve(q, {
              repository: context.repository,
            });

            if (!result.resolved || result.status !== "active" || !result.account) {
              throw new ApiError(404, "not_found", "Federation record not found");
            }

            const response = apiSuccess(request, {
              stellar_address: q,
              account_id: result.account,
            });
            response.headers.set("Access-Control-Allow-Origin", "*");
            return response;
          } else if (type === "id") {
            const result = await defaultIdentityResolver.resolve(q, {
              repository: context.repository,
            });

            if (
              !result.resolved ||
              result.status !== "active" ||
              !result.canonicalAddress ||
              !result.account
            ) {
              throw new ApiError(404, "not_found", "Federation record not found");
            }

            const fedAddress = result.canonicalAddress.replace("@", "*");

            const response = apiSuccess(request, {
              stellar_address: fedAddress,
              account_id: result.account,
            });
            response.headers.set("Access-Control-Allow-Origin", "*");
            return response;
          } else {
            throw new ApiError(400, "bad_request", "Unsupported federation query type");
          }
        }),
    },
  },
});
