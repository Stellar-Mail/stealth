import { createFileRoute } from "@tanstack/react-router";

import { loadRuntimeConfig } from "@/config";
import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema } from "@/server/api/domain";
import {
  assertLifecycleParticipant,
  buildLifecycleChainAdapter,
  reconcileLifecycleStatus,
} from "@/server/api/lifecycle-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/lifecycle/$messageId/reconcile")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const messageId = hash32Schema.parse(params.messageId);
          const actor = requireActor(context);
          const adapter = buildLifecycleChainAdapter(loadRuntimeConfig());
          const anchor = await reconcileLifecycleStatus(context.repository, adapter, messageId);
          assertLifecycleParticipant(anchor, actor);
          return apiSuccess(request, anchor);
        }),
    },
  },
});
