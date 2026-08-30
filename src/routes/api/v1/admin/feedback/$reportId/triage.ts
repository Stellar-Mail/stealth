/**
 * POST /api/v1/admin/feedback/:reportId/triage
 * Admin: record triage notes on an open feedback report.
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { requireAdminRole, recordAdminMutationAudit } from "@/server/api/authorization/admin";
import { triageFeedbackReport } from "@/server/api/feedback-service";

const triageBodySchema = z.object({
  triageNotes: z
    .string()
    .min(4, "Triage notes must be at least 4 characters")
    .max(1000, "Triage notes cannot exceed 1000 characters"),
});

export const Route = createFileRoute("/api/v1/admin/feedback/$reportId/triage")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);
          const actor = context.principal?.address ?? "admin";

          const { reportId } = params;
          const body = await parseJsonBody(request, triageBodySchema, {
            route: "POST /api/v1/admin/feedback/:reportId/triage",
          });

          const requestId = crypto.randomUUID();
          const report = await triageFeedbackReport(
            context.repository,
            reportId,
            body.triageNotes,
            actor ?? "admin",
          );

          recordAdminMutationAudit({
            actor: actor ?? "admin",
            action: "feedback.triage",
            target: reportId,
            reason: body.triageNotes,
            beforeState: { status: "open" },
            afterState: { status: report.status },
            requestId,
            result: "success",
          });

          return apiSuccess(request, { report });
        }),
    },
  },
});
