import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema } from "@/server/api/domain";
import { retrySenderRuleWrite } from "@/server/api/sender-rule-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const retryBodySchema = z.object({});

export const Route = createFileRoute("/api/v1/policies/$owner/senders/$sender/retry")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          const sender = stellarAddressSchema.parse(params.sender);

          await parseJsonBody(request, retryBodySchema, {
            route: "POST /policies/{owner}/senders/{sender}/retry",
          });

          const updated = await retrySenderRuleWrite(context.repository, owner, sender);

          return apiSuccess(request, {
            owner: updated.owner,
            sender: updated.sender,
            rule: updated.rule,
            version: updated.version,
            chainStatus: updated.chainStatus,
          });
        }),
    },
  },
});
