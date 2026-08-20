import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { readPublicWalletStatus } from "@/services/stellar/wallet-status";
import { loadRuntimeConfig } from "@/config";

const querySchema = z.object({
  address: z.string().optional(),
});

/**
 * GET /api/v1/wallet/status
 *
 * Authenticated, owner-only read of managed-wallet public metadata: address,
 * testnet balance, activation, and last-sync freshness. Response types have
 * no custody fields.
 */
export const Route = createFileRoute("/api/v1/wallet/status")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const actor = requireActor(apiContext);
          const url = new URL(request.url);
          const parsed = querySchema.parse({
            address: url.searchParams.get("address") || undefined,
          });
          const status = await readPublicWalletStatus({
            repository: apiContext.repository,
            actorAddress: actor,
            requestedAddress: parsed.address,
            config: loadRuntimeConfig(),
          });
          return apiSuccess(request, status);
        }),
    },
  },
});
