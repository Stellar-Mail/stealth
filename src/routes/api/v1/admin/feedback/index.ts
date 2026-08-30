/**
 * Admin operations console routes for feedback report triage and export.
 *
 * GET    /api/v1/admin/feedback           — list reports (filterable)
 * GET    /api/v1/admin/feedback/export    — NDJSON export of all reports
 * POST   /api/v1/admin/feedback/:id/triage  — add triage notes
 * POST   /api/v1/admin/feedback/:id/close   — close / resolve / wont-fix
 *
 * All routes require a valid admin session (≤15 min old).
 * Exported payloads never contain plaintext message bodies, tokens,
 * keys, seeds, or raw address books.
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import {
  feedbackStatusSchema,
  type FeedbackStatus,
  type FeedbackCategory,
} from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { requireAdminRole, recordAdminMutationAudit } from "@/server/api/authorization/admin";
import {
  closeFeedbackReport,
  triageFeedbackReport,
  exportFeedbackReports,
} from "@/server/api/feedback-service";
import { ApiError } from "@/server/api/errors";

// ---------------------------------------------------------------------------
// GET /api/v1/admin/feedback
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/api/v1/admin/feedback/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const actor = await requireAdminRole(context, request);

          const url = new URL(request.url);
          const status = url.searchParams.get("status") as FeedbackStatus | null;
          const category = url.searchParams.get("category") as FeedbackCategory | null;
          const limitParam = url.searchParams.get("limit");
          const after = url.searchParams.get("after") ?? undefined;
          const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 200) : 50;

          // Validate status filter
          if (status) {
            const parsed = feedbackStatusSchema.safeParse(status);
            if (!parsed.success) {
              throw new ApiError(400, "bad_request", `Invalid status filter: ${status}`);
            }
          }

          const reports = await exportFeedbackReports(context.repository, {
            status: status ?? undefined,
            category: category ?? undefined,
            limit,
          });

          return apiSuccess(request, {
            reports,
            count: reports.length,
            hasMore: reports.length === limit,
          });
        }),
    },
  },
});
