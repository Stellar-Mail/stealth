import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  requireAdminRole,
  recordAdminMutationAudit,
  adminMutationSchema,
} from "@/server/api/authorization/admin";
import { getBetaControlService, initBetaControlService } from "@/server/api/beta-controls";
import {
  BETA_CAPABILITIES,
  betaCapabilitySchema,
  killSwitchStateSchema,
} from "@/server/api/beta-controls/types";

const setKillSwitchSchema = adminMutationSchema.extend({
  capability: betaCapabilitySchema,
  state: killSwitchStateSchema,
  expectedVersion: z.number().int().positive().optional(),
});

export const Route = createFileRoute("/api/v1/admin/beta/killswitches/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const service = getBetaControlService();
          const evaluations = await Promise.all(
            BETA_CAPABILITIES.map((capability) => service.evaluateKillSwitch(capability)),
          );
          return apiSuccess(request, { killSwitches: evaluations });
        }),

      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const body = await request.json();
          const parsed = setKillSwitchSchema.parse(body);
          const actor = context.principal!.address;

          const service = getBetaControlService();
          const record = await service.setKillSwitch(parsed.capability, parsed.state, {
            actor,
            reason: parsed.reason,
            expectedVersion: parsed.expectedVersion,
            requestId: context.requestId || "",
          });

          const supportId = recordAdminMutationAudit({
            actor,
            action: "beta.killswitch.set",
            target: `killswitch:${parsed.capability}`,
            reason: parsed.reason,
            beforeState: null,
            afterState: {
              capability: parsed.capability,
              state: parsed.state,
              version: record.version,
            },
            requestId: context.requestId || "",
            result: "success",
          });

          return apiSuccess(request, { killSwitch: record, supportId }, { status: 200 });
        }),
    },
  },
});
