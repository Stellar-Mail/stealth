import { createFileRoute } from "@tanstack/react-router";

import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { getBetaControlService, initBetaControlService } from "@/server/api/beta-controls";
import { BETA_CAPABILITIES } from "@/server/api/beta-controls/types";

/**
 * GET /api/v1/beta/state
 *
 * Read-only, client-safe projection of beta controls. Exposes kill-switch state
 * (so clients can disable UI) and feature-flag evaluation for the requesting
 * account. Contains NO secrets, tokens, or credentials. Operators use the
 * protected /api/v1/admin/beta/* routes to mutate state.
 */
export const Route = createFileRoute("/api/v1/beta/state")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request).catch(() => null);
          const account = context?.isAuthenticated ? (context.principal?.address ?? null) : null;

          const service = getBetaControlService();
          const killSwitches = await Promise.all(
            BETA_CAPABILITIES.map(async (capability) => {
              const evaluation = await service.evaluateKillSwitch(capability);
              return { capability, enabled: evaluation.enabled, source: evaluation.source };
            }),
          );

          const flags = await service.listFlags();
          const featureFlags: Record<string, boolean> = {};
          for (const flag of flags) {
            const evaluation = await service.isFeatureEnabled(flag.key, {
              account: account ?? undefined,
            });
            featureFlags[flag.key] = evaluation.enabled;
          }

          return apiSuccess(request, {
            killSwitches,
            featureFlags,
            evaluatedFor: account,
          });
        }),
    },
  },
});
