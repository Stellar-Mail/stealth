import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { parseDelegationHeader, requireActorMatches } from "@/server/api/actor";
import { mailboxPolicyWriteSchema, stellarAddressSchema } from "@/server/api/domain";
import { getApiContext } from "@/server/api/context";
import {
  getMailboxPolicy,
  setMailboxPolicy,
  deriveMailboxSyncStatus,
} from "@/server/api/policy-service";
import { syncMailboxPolicyWrite } from "@/server/api/policy-sync-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const mailboxPolicyPutSchema = mailboxPolicyWriteSchema.extend({
  expectedVersion: z.number().int().min(0).optional(),
});

export const Route = createFileRoute("/api/v1/policies/$owner")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          const result = await getMailboxPolicy(context.repository, owner);
          return apiSuccess(request, result);
        }),
      PUT: ({ request, params }) =>
        handleApiRequest(request, async () => {
          const context = await getApiContext(request);
          const owner = stellarAddressSchema.parse(params.owner);
          requireActorMatches(
            context,
            owner,
            parseDelegationHeader(request, "policy:update", `mailbox:${owner}:policy`),
          );
          const body = await parseJsonBody(request, mailboxPolicyPutSchema, {
            route: "PUT /policies/{owner}",
          });
          const { requireReceipt, expectedVersion, version, ...policy } = body;
          const result = await setMailboxPolicy(context.repository, owner, policy, {
            requireReceipt,
            expectedVersion: expectedVersion ?? version,
          });
          const syncResult = await syncMailboxPolicyWrite(
            context.repository,
            owner,
            context.requestId ?? "policy-sync",
          );
          const intent = await context.repository.getPolicyWriteIntent(owner);
          return apiSuccess(request, {
            ...result,
            sync: await deriveMailboxSyncStatus(context.repository, owner),
            txHash: syncResult.txHash ?? intent?.txHash ?? null,
          });
        }),
    },
  },
});
