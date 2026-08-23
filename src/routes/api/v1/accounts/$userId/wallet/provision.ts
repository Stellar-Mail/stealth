import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActorMatches } from "@/server/api/actor";
import { provisionManagedStellarWallet } from "@/server/api/account-provisioning";
import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { withIdempotency } from "@/server/api/idempotency-service";
import { loadRuntimeConfig } from "@/config";
import { createFundingAdapter } from "@/services/stellar/funding-adapter";

const paramsSchema = z.object({
  userId: z.string().min(1, "User ID cannot be empty"),
});

/**
 * POST /api/v1/accounts/{userId}/wallet/provision
 *
 * Idempotently provisions (or returns) the system-managed Stellar testnet wallet
 * for the account. Responses never include seed phrases or raw private keys.
 */
export const Route = createFileRoute("/api/v1/accounts/$userId/wallet/provision")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const { userId } = paramsSchema.parse(params);
          const user = await apiContext.repository.getUserById(userId);
          if (!user) {
            throw new ApiError(404, "not_found", "Account not found");
          }

          requireActorMatches(apiContext, user.address);

          const origin =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";
          const config = loadRuntimeConfig();
          const storageSecret = config.secrets?.storageSecret ?? "dev-storage-secret-change-me";
          const rawIdempotencyKey = request.headers.get("x-idempotency-key");

          const provision = async () => {
            const result = await provisionManagedStellarWallet(
              apiContext.repository,
              userId,
              config,
              {
                fundingAdapter: createFundingAdapter({
                  useFake: config.profile === "development" || config.profile === "test",
                }),
                storageSecret,
                accountId: userId,
                origin,
              },
            );
            return { status: 200, body: result };
          };

          const result = rawIdempotencyKey
            ? await withIdempotency(
                apiContext.repository,
                {
                  actor: user.address,
                  method: request.method,
                  route: "POST /accounts/{userId}/wallet/provision",
                  rawKey: rawIdempotencyKey,
                },
                { userId },
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
