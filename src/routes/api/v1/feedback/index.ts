/**
 * POST /api/v1/feedback — beta tester defect report submission.
 *
 * Security:
 * - No session is required; the reporter is identified by a browser-generated
 *   support token, never by their Stellar address or session cookie.
 * - Rate-limited to 5 reports per reporter token per hour.
 * - Steps text is scrubbed for secret-like patterns before persistence.
 * - Screenshots are stripped when screenshotConsent is false.
 * - Message body, tokens, keys and raw address books are never collected.
 *
 * ?preview=true — show the exact sanitised payload without persisting (dry-run).
 */

import { createFileRoute } from "@tanstack/react-router";

import { getApiContext } from "@/server/api/context";
import { feedbackSubmitSchema } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { buildSubmissionPreview, submitFeedbackReport } from "@/server/api/feedback-service";

export const Route = createFileRoute("/api/v1/feedback/")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);

          const input = await parseJsonBody(request, feedbackSubmitSchema, {
            route: "POST /api/v1/feedback",
          });

          // The reporterId is an opaque support token supplied by the client
          // via the X-Support-Id header. When absent we mint a random token —
          // the value is never an account address.
          const rawSupportId = request.headers.get("x-support-id") ?? "";
          const reporterId = /^[A-Za-z0-9_-]{8,128}$/.test(rawSupportId)
            ? rawSupportId
            : `anon_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

          // Preview mode: show what would be stored without persisting it.
          const url = new URL(request.url);
          if (url.searchParams.get("preview") === "true") {
            const preview = buildSubmissionPreview(input, reporterId);
            return apiSuccess(request, { preview, persisted: false });
          }

          const report = await submitFeedbackReport(context.repository, input, reporterId);

          return apiSuccess(request, { report, persisted: true }, { status: 201 });
        }),
    },
  },
});
