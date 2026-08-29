import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdminRole, adminMutationSchema } from "@/server/api/authorization/admin";
import { getApiContext } from "@/server/api/context";
import { feedbackStatusSchema } from "@/server/api/domain";
import { toFeedbackOperatorView, updateFeedbackWorkflow } from "@/server/api/feedback-service";
import { ApiError } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const updateSchema = adminMutationSchema
  .extend({
    expectedVersion: z.number().int().positive(),
    status: feedbackStatusSchema,
    triageNote: z.string().max(1000).nullable().optional(),
  })
  .strict();

export const Route = createFileRoute("/api/v1/admin/feedback/$reportId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);
          const report = await context.repository.getFeedbackReport(params.reportId);
          if (!report) throw new ApiError(404, "not_found", "Feedback report not found");
          return apiSuccess(request, { report: toFeedbackOperatorView(report) });
        }),
      PATCH: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const operator = await requireAdminRole(context, request);
          const body = await parseJsonBody(request, updateSchema, {
            route: "PATCH /api/v1/admin/feedback/{reportId}",
          });
          const report = await updateFeedbackWorkflow({
            repository: context.repository,
            reportId: params.reportId,
            expectedVersion: body.expectedVersion,
            status: body.status,
            triageNote: body.triageNote,
            operator,
            reason: body.reason,
            requestId: context.requestId || "",
          });
          return apiSuccess(request, { report: toFeedbackOperatorView(report) });
        }),
    },
  },
});
