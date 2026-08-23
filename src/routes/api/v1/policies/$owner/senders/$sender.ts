import { createFileRoute } from "@tanstack/react-router";

import { parseDelegationHeader, requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { senderRuleWriteSchema, stellarAddressSchema } from "@/server/api/domain";
import { getSenderRule, setSenderRule } from "@/server/api/policy-service";
import {
  syncSenderRuleWrite,
  syncVersionedSenderRuleRecord,
} from "@/server/api/policy-sync-service";
import {
  createOrUpdateSenderRule,
  deleteSenderRule,
  getSenderRuleRecord,
} from "@/server/api/sender-rule-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

export const Route = createFileRoute("/api/v1/policies/$owner/senders/$sender")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          const sender = stellarAddressSchema.parse(params.sender);
          requireActorMatches(
            context,
            owner,
            parseDelegationHeader(
              request,
              "policy:senders:read",
              `mailbox:${owner}:senders:${sender}`,
            ),
          );

          // Return versioned record if available, fall back to legacy
          const record = await getSenderRuleRecord(context.repository, owner, sender);
          if (record) {
            return apiSuccess(request, {
              owner,
              sender,
              rule: record.rule,
              pricePayload: record.pricePayload,
              version: record.version,
              chainStatus: record.chainStatus,
              scheduledAt: record.scheduledAt,
              updatedAt: record.updatedAt,
              confirmedAt: record.confirmedAt,
              txHash: record.txHash,
            });
          }

          return apiSuccess(request, await getSenderRule(context.repository, owner, sender));
        }),

      PUT: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          const sender = stellarAddressSchema.parse(params.sender);
          requireActorMatches(
            context,
            owner,
            parseDelegationHeader(
              request,
              "policy:senders:update",
              `mailbox:${owner}:senders:${sender}`,
            ),
          );

          const body = await parseJsonBody(request, senderRuleWriteSchema, {
            route: "PUT /policies/{owner}/senders/{sender}",
          });

          const result = await createOrUpdateSenderRule(context.repository, owner, sender, {
            rule: body.rule,
            pricePayload: body.pricePayload,
            version: body.version,
            idempotencyKey: body.idempotencyKey,
          });

          const synced = await syncVersionedSenderRuleRecord(
            context.repository,
            result.rule,
            context.requestId ?? "policy-sync",
          );

          return apiSuccess(request, {
            owner: result.owner,
            sender: result.sender,
            rule: synced.rule,
            pricePayload: synced.pricePayload,
            version: synced.version,
            chainStatus: synced.chainStatus,
            scheduledAt: synced.scheduledAt,
            updatedAt: synced.updatedAt,
            confirmedAt: synced.confirmedAt,
            txHash: synced.txHash,
            created: result.created,
          });
        }),

      DELETE: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          const sender = stellarAddressSchema.parse(params.sender);
          requireActorMatches(
            context,
            owner,
            parseDelegationHeader(
              request,
              "policy:senders:delete",
              `mailbox:${owner}:senders:${sender}`,
            ),
          );

          // Delete versioned record + legacy rule
          const { deleted } = await deleteSenderRule(context.repository, owner, sender);

          // Also clear the legacy sender rule and submit the default override on-chain.
          await setSenderRule(context.repository, owner, sender, "default");
          await syncSenderRuleWrite(
            context.repository,
            owner,
            sender,
            context.requestId ?? "policy-sync",
          );

          return apiSuccess(request, { owner, sender, deleted });
        }),
    },
  },
});
