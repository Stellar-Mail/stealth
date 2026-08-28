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

const createInviteSchema = adminMutationSchema.extend({
  code: z.string().min(1).max(50),
  cohortId: z.string().max(64).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const Route = createFileRoute("/api/v1/admin/beta/invites/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);
          const invites = await getBetaControlService().listInvites();
          return apiSuccess(request, { invites });
        }),

      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const body = await request.json();
          const parsed = createInviteSchema.parse(body);
          const actor = context.principal!.address;

          const saved = await getBetaControlService().createInvite({
            code: parsed.code,
            cohortId: parsed.cohortId ?? null,
            createdBy: actor,
            expiresAt: parsed.expiresAt ?? null,
            reason: parsed.reason,
          });

          const supportId = recordAdminMutationAudit({
            actor,
            action: "beta.invite.create",
            target: `invite:${saved.code}`,
            reason: parsed.reason,
            beforeState: null,
            afterState: { code: saved.code, cohortId: saved.cohortId, status: saved.status },
            requestId: context.requestId || "",
            result: "success",
          });

          return apiSuccess(request, { invite: saved, supportId }, { status: 200 });
        }),
    },
  },
});
