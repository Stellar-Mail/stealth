import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdminRole } from "@/server/api/authorization/admin";
import { recordAuditEvent } from "@/server/api/audit";
import { getApiContext } from "@/server/api/context";
import { exportFeedbackReports, feedbackActorReference } from "@/server/api/feedback-service";
import { handleApiRequest } from "@/server/api/response";

const formatSchema = z.enum(["json", "csv"]);

export const Route = createFileRoute("/api/v1/admin/feedback/export")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const operator = await requireAdminRole(context, request);
          const url = new URL(request.url);
          const format = formatSchema.parse(url.searchParams.get("format") || "json");
          const reports = await context.repository.listFeedbackReports({ limit: 200 });
          const body = exportFeedbackReports(reports, format);
          recordAuditEvent({
            actor: feedbackActorReference("op", operator),
            action: "feedback.export",
            targetType: "feedback_report_collection",
            safeTargetReference: `count:${reports.length}`,
            result: "success",
            requestId: context.requestId || "",
          });
          return new Response(body, {
            headers: {
              "cache-control": "no-store",
              "content-disposition": `attachment; filename="feedback-export.${format}"`,
              "content-type":
                format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
              "x-content-type-options": "nosniff",
            },
          });
        }),
    },
  },
});
