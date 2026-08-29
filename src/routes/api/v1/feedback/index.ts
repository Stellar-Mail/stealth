import { createFileRoute } from "@tanstack/react-router";

import { getApiContext } from "@/server/api/context";
import {
  createFeedbackReport,
  feedbackSubmissionSchema,
  requireFeedbackActor,
} from "@/server/api/feedback-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/feedback/")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = await requireFeedbackActor(context, request);
          const submission = await parseJsonBody(request, feedbackSubmissionSchema, {
            route: "POST /feedback",
          });
          const report = await createFeedbackReport({
            repository: context.repository,
            actor,
            request,
            submission,
          });

          return apiSuccess(
            request,
            {
              reportId: report.reportId,
              status: report.status,
              receivedAt: report.createdAt,
              diagnosticsIncluded: report.diagnostics !== null,
              screenshotIncluded: report.screenshot !== null,
            },
            { status: 201 },
          );
        }),
    },
  },
});
