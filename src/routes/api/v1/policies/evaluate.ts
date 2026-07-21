import { createFileRoute } from "@tanstack/react-router";

import { getApiContext } from "@/server/api/context";
import { policyEvaluationRequestSchema } from "@/server/api/domain";
import { evaluateMailboxPolicy } from "@/server/api/policy-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/policies/evaluate")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const input = await parseJsonBody(request, policyEvaluationRequestSchema);
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
