import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { ApiError } from "@/server/api/errors";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  requireAdminRole,
  recordAdminMutationAudit,
  adminMutationSchema,
} from "@/server/api/authorization/admin";
import { getBetaControlService, initBetaControlService } from "@/server/api/beta-controls";

const revokeInviteSchema = adminMutationSchema;

export const Route = createFileRoute("/api/v1/admin/beta/invites/$code")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);
          const invite = await getBetaControlService().getInvite(params.code);
          if (!invite) throw new ApiError(404, "not_found", `Invite '${params.code}' not found`);
          return apiSuccess(request, { invite });
        }),

      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          await initBetaControlService();
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const body = await request.json().catch(() => ({}));
          const parsed = revokeInviteSchema.parse(body);
          const actor = context.principal!.address;

          const saved = await getBetaControlService().revokeInvite(
            params.code,
            actor,
            parsed.reason,
            context.requestId || "",
          );

          const supportId = recordAdminMutationAudit({
            actor,
            action: "beta.invite.revoke",
            target: `invite:${saved.code}`,
            reason: parsed.reason,
            beforeState: { code: saved.code },
            afterState: { code: saved.code, status: saved.status },
            requestId: context.requestId || "",
            result: "success",
          });

          return apiSuccess(request, { invite: saved, supportId });
        }),
    },
  },
});
