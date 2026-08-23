import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { parseDelegationHeader, requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { stellarAddressSchema } from "@/server/api/domain";
import { listSenderRules } from "@/server/api/sender-rule-service";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  after: z.string().optional(),
});

export const Route = createFileRoute("/api/v1/policies/$owner/senders/")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          requireActorMatches(
            context,
            owner,
            parseDelegationHeader(request, "policy:senders:read", `mailbox:${owner}:senders`),
          );

          const url = new URL(request.url);
          const query = listQuerySchema.parse({
            limit: url.searchParams.get("limit"),
            after: url.searchParams.get("after"),
          });

          const result = await listSenderRules(context.repository, owner, {
            limit: query.limit,
            after: query.after,
          });

          return apiSuccess(request, {
            records: result.records.map((r) => ({
              owner: r.owner,
              sender: r.sender,
              rule: r.rule,
              pricePayload: r.pricePayload,
              version: r.version,
              chainStatus: r.chainStatus,
              scheduledAt: r.scheduledAt,
              updatedAt: r.updatedAt,
              confirmedAt: r.confirmedAt,
              txHash: r.txHash,
            })),
            nextCursor: result.nextCursor,
          });
        }),
    },
  },
});
