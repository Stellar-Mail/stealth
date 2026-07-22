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

          const reasonMessages: Record<string, string> = {
            sender_allowed: "Sender is explicitly allowed by the recipient.",
            sender_blocked: "Sender is explicitly blocked by the recipient.",
            unknown_senders_disabled: "Recipient does not accept mail from unknown senders.",
            verification_required: "Recipient requires sender verification.",
            insufficient_postage: "Provided postage is insufficient for this recipient.",
            policy_satisfied: "Sender satisfies all recipient mailbox policies.",
          };

          const decision = {
            allowed: result.allowed,
            reasonCode: result.reason,
            message: reasonMessages[result.reason] ?? "Unknown policy evaluation result.",
          };

          return apiSuccess(request, decision);
        }),
    },
  },
});
