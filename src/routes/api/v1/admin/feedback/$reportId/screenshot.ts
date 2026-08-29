import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdminRole, adminMutationSchema } from "@/server/api/authorization/admin";
import { recordAuditEvent } from "@/server/api/audit";
import { getApiContext } from "@/server/api/context";
import {
  feedbackActorReference,
  removeFeedbackScreenshot,
  toFeedbackOperatorView,
  validateStoredFeedbackReport,
} from "@/server/api/feedback-service";
import { ApiError } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const removeSchema = adminMutationSchema
  .extend({ expectedVersion: z.number().int().positive() })
  .strict();

function screenshotBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function screenshotBody(base64: string): ArrayBuffer {
  const bytes = screenshotBytes(base64);
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return body;
}

export const Route = createFileRoute("/api/v1/admin/feedback/$reportId/screenshot")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const operator = await requireAdminRole(context, request);
          const stored = await context.repository.getFeedbackReport(params.reportId);
          if (!stored) {
            throw new ApiError(404, "not_found", "Feedback screenshot not found");
          }
          const report = validateStoredFeedbackReport(stored, context.requestId);
          if (!report.screenshot) {
            throw new ApiError(404, "not_found", "Feedback screenshot not found");
          }
          recordAuditEvent({
            actor: feedbackActorReference("op", operator),
            action: "feedback.screenshot.view",
            targetType: "feedback_report",
            safeTargetReference: params.reportId,
            result: "success",
            requestId: context.requestId || "",
          });
          return new Response(screenshotBody(report.screenshot.base64), {
            headers: {
              "cache-control": "no-store",
              "content-disposition": `inline; filename="${params.reportId}-screenshot"`,
              "content-length": String(report.screenshot.sizeBytes),
              "content-type": report.screenshot.mediaType,
              "x-content-type-options": "nosniff",
            },
          });
        }),
      DELETE: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const operator = await requireAdminRole(context, request);
          const body = await parseJsonBody(request, removeSchema, {
            route: "DELETE /api/v1/admin/feedback/{reportId}/screenshot",
          });
          const report = await removeFeedbackScreenshot({
            repository: context.repository,
            reportId: params.reportId,
            expectedVersion: body.expectedVersion,
            operator,
            reason: body.reason,
            requestId: context.requestId || "",
          });
          return apiSuccess(request, { report: toFeedbackOperatorView(report) });
        }),
    },
  },
});
