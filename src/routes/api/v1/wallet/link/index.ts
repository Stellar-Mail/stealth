import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { listExternalWallets } from "@/server/api/wallet-link-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/wallet/link/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const owner = requireActor(request);
          const repo = (await getApiContext()).repository;
          const wallets = await listExternalWallets(repo, owner);
          return apiSuccess(request, { wallets });
        }),
    },
  },
});
