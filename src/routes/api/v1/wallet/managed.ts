import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { getManagedWalletStatus } from "@/server/api/wallet-link-service";
import { loadRuntimeConfig } from "@/config";

export const Route = createFileRoute("/api/v1/wallet/managed")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const owner = requireActor(request);
          const repo = (await getApiContext()).repository;
          let horizonUrl: string | undefined;
          let network: string | undefined;
          try {
            const config = loadRuntimeConfig();
            horizonUrl = config.network?.horizonUrl;
            network = config.network?.networkPassphrase;
          } catch {
            // fallback
          }

          const status = await getManagedWalletStatus(repo, owner, horizonUrl, network);
          return apiSuccess(request, status);
        }),
    },
  },
});
