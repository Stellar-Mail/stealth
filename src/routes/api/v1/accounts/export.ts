// BETA-080 (Issue #1987): authenticated, ciphertext-only account export.
import { createFileRoute } from "@tanstack/react-router";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { exportAccountData } from "@/server/api/account-data-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/accounts/export")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = requireActor(context);
          const data = await exportAccountData(context.repository, actor);
          return apiSuccess(request, data, {
            headers: { "content-disposition": "attachment; filename=stealth-account-export.json" },
          });
        }),
    },
  },
});
