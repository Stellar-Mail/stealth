import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import {
  stellarAddressSchema,
  networkPassphraseSchema,
  walletCapabilitySchema,
} from "@/server/api/domain";
import { verifyChallenge, linkExternalWallet } from "@/server/api/wallet-link-service";
import { ApiError } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const verifyRequestSchema = z.object({
  address: stellarAddressSchema,
  signature: z.string().min(1),
  capabilities: z.array(walletCapabilitySchema).min(1),
  network: networkPassphraseSchema,
});

export const Route = createFileRoute("/api/v1/wallet/link/verify")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const owner = requireActor(request);
          const input = await parseJsonBody(request, verifyRequestSchema);
          const repo = (await getApiContext()).repository;

          const result = await verifyChallenge(
            repo,
            owner,
            input.address,
            input.signature,
            input.address,
            input.network,
          );

          if (!result.verified) {
            throw new ApiError(
              400,
              "bad_request",
              `Challenge verification failed: ${result.reason}`,
            );
          }

          const wallet = await linkExternalWallet(repo, owner, {
            address: input.address,
            capabilities: input.capabilities,
            linkedAt: new Date().toISOString(),
            network: input.network,
          });

          return apiSuccess(request, wallet);
        }),
    },
  },
});
