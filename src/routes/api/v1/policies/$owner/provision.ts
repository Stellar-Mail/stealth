import { createFileRoute } from "@tanstack/react-router";

import { requireActorMatches } from "@/server/api/actor";
import { initializeMailboxPolicyDefaults } from "@/server/api/account-provisioning";
import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema } from "@/server/api/domain";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { withIdempotency } from "@/server/api/idempotency-service";

export const Route = createFileRoute("/api/v1/policies/$owner/provision")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          requireActorMatches(apiContext, owner);

          const repo = apiContext.repository;
          const rawIdempotencyKey = request.headers.get("x-idempotency-key");

          const provision = async () => {
            const result = await initializeMailboxPolicyDefaults(repo, owner);
            return { status: 200, body: result };
          };

          const result = rawIdempotencyKey
            ? await withIdempotency(
                repo,
                {
                  actor: owner,
                  method: request.method,
                  route: "POST /policies/{owner}/provision",
                  rawKey: rawIdempotencyKey,
                },
                { owner },
                provision,
              )
            : { ...(await provision()), replayed: false };

          return apiSuccess(request, result.body, {
            ...(result.replayed ? { headers: { "x-idempotency-replayed": "true" } } : {}),
          });
        }),
    },
  },
});
