import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema, networkPassphraseSchema } from "@/server/api/domain";
import { createChallenge } from "@/server/api/wallet-link-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const challengeRequestSchema = z.object({
  address: stellarAddressSchema,
  network: networkPassphraseSchema,
});

export const Route = createFileRoute("/api/v1/wallet/link/challenge")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const owner = requireActor(request);
          const input = await parseJsonBody(request, challengeRequestSchema);
          const repo = (await getApiContext()).repository;
          const challenge = await createChallenge(repo, owner, input.address, input.network);
          return apiSuccess(request, {
            challenge: challenge.challenge,
            expiresAt: challenge.expiresAt,
          });
        }),
    },
  },
});
