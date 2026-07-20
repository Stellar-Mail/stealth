import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema, stroopAmountSchema } from "@/server/api/domain";
import { evaluateMailboxPolicy } from "@/server/api/policy-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const evaluationSchema = z.object({
  owner: stellarAddressSchema,
  postage: stroopAmountSchema,
  sender: stellarAddressSchema,
  verified: z.boolean(),
});

export const Route = createFileRoute("/api/v1/policies/evaluate")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const input = await parseJsonBody(request, evaluationSchema);
          const result = await evaluateMailboxPolicy((await getApiContext()).repository, input);
          return apiSuccess(request, result);
        }),
    },
  },
});
