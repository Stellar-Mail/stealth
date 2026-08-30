/**
 * POST /api/v1/admin/feedback/:reportId/close
 * Admin: close, resolve, or mark won't-fix on a feedback report.
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { requireAdminRole, recordAdminMutationAudit } from "@/server/api/authorization/admin";
import { closeFeedbackReport } from "@/server/api/feedback-service";

const closeBodySchema = z.object({
  status: z.enum(["resolved", "closed", "wont_fix"]),
  reason: z
    .string()
    .min(4, "Reason must be at least 4 characters")
    .max(500, "Reason cannot exceed 500 characters"),
});

export const Route = createFileRoute("/api/v1/admin/feedback/$reportId/close")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);
          const actor = context.principal?.address ?? "admin";

          const { reportId } = params;
          const body = await parseJsonBody(request, closeBodySchema, {
            route: "POST /api/v1/admin/feedback/:reportId/close",
          });

          const requestId = crypto.randomUUID();
          const report = await closeFeedbackReport(
            context.repository,
            reportId,
            body.status,
            actor ?? "admin",
          );

          recordAdminMutationAudit({
            actor: actor ?? "admin",
            action: `feedback.${body.status}`,
            target: reportId,
            reason: body.reason,
            beforeState: { status: "open" },
            afterState: { status: report.status, resolvedBy: report.resolvedBy },
            requestId,
            result: "success",
          });

          return apiSuccess(request, { report });
        }),
    },
  },
});
