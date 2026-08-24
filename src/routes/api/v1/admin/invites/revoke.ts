import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  requireAdminRole,
  recordAdminMutationAudit,
  adminMutationSchema,
} from "@/server/api/authorization/admin";
import { ApiError } from "@/server/api/errors";

const revokeInviteSchema = adminMutationSchema.extend({
  code: z.string().min(1),
});

export const Route = createFileRoute("/api/v1/admin/invites/revoke")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const body = await request.json();
          const parsed = revokeInviteSchema.parse(body);

          const codeUpper = parsed.code.trim().toUpperCase();
          const invite = await context.repository.getInvite(codeUpper);
          if (!invite) {
            throw new ApiError(404, "not_found", "Invite code not found");
          }

          if (invite.status === "revoked") {
            throw new ApiError(409, "conflict", "Invite code is already revoked");
          }

          const beforeState = { ...invite };
          const actor = context.principal!.address;
          invite.status = "revoked";
          invite.revokedAt = new Date().toISOString();
          invite.revokedBy = actor;
          invite.reason = parsed.reason;

          const saved = await context.repository.setInvite(invite);

          const supportId = recordAdminMutationAudit({
            actor,
            action: "invite.revoke",
            target: `invite:${codeUpper}`,
            reason: parsed.reason,
            beforeState,
            afterState: saved,
            requestId: context.requestId || "",
            result: "success",
          });

          return apiSuccess(request, { invite: saved, supportId });
        }),
    },
  },
});
