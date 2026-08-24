import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  requireAdminRole,
  recordAdminMutationAudit,
  adminMutationSchema,
} from "@/server/api/authorization/admin";
import type { Invite } from "@/server/api/domain";
import { ApiError } from "@/server/api/errors";

const createInviteSchema = adminMutationSchema.extend({
  code: z.string().min(1).max(50),
});

export const Route = createFileRoute("/api/v1/admin/invites/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const invites = await context.repository.listInvites();
          return apiSuccess(request, { invites });
        }),

      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const body = await request.json();
          const parsed = createInviteSchema.parse(body);

          const codeUpper = parsed.code.trim().toUpperCase();
          const existing = await context.repository.getInvite(codeUpper);
          if (existing) {
            throw new ApiError(409, "conflict", "Invite code already exists");
          }

          const actor = context.principal!.address;
          const invite: Invite = {
            code: codeUpper,
            status: "active",
            createdAt: new Date().toISOString(),
            createdBy: actor,
            revokedAt: null,
            revokedBy: null,
            reason: parsed.reason,
          };

          const beforeState = null;
          const saved = await context.repository.setInvite(invite);

          const supportId = recordAdminMutationAudit({
            actor,
            action: "invite.create",
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
