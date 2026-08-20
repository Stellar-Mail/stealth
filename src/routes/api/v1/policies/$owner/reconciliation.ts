import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema } from "@/server/api/domain";
import { getPolicyReconciliation } from "@/server/api/policy-service";
import { parseSearchParams } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const reconciliationQuerySchema = z.object({
  /**
   * On-chain policy version reported by the Policies contract. When absent,
   * reconciliation is derived from the durable write intent alone (the chain
   * client that supplies this is wired by BETA-017 / Issue #1924).
   */
  chainVersion: z.coerce.number().int().min(0).optional(),
});

export const Route = createFileRoute("/api/v1/policies/$owner/reconciliation")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          const query = parseSearchParams(request, reconciliationQuerySchema);
          const result = await getPolicyReconciliation(context.repository, owner, {
            ...(query.chainVersion === undefined ? {} : { version: query.chainVersion }),
          });
          return apiSuccess(request, result);
        }),
    },
  },
});
