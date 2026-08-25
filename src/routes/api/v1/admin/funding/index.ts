import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { fundingOperationStatusSchema } from "@/server/api/domain";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { requireAdminRole } from "@/server/api/authorization/admin";
import { listPublicFundingQueue } from "@/services/stellar/funding";

const querySchema = z.object({
  status: fundingOperationStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET /api/v1/admin/funding/
 *
 * Administrator-visible funding queue. Returns public operation metadata only —
 * never seeds, encrypted secrets, or storage keys.
 */
export const Route = createFileRoute("/api/v1/admin/funding/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          await requireAdminRole(context, request);

          const url = new URL(request.url);
          const parsed = querySchema.parse({
            status: url.searchParams.get("status") || undefined,
            limit: url.searchParams.get("limit") || undefined,
          });
          const operations = await listPublicFundingQueue(context.repository, parsed);
          return apiSuccess(request, { operations });
        }),
    },
  },
});
