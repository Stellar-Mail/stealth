import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema, stellarAddressSchema, stroopAmountSchema } from "@/server/api/domain";
import { buildDeviceFingerprint } from "@/server/api/abuse-service";
import {
  submitPostage,
  verifyQuoteSubmission,
  type SubmitPostageContext,
} from "@/server/api/postage-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { withIdempotency } from "@/server/api/idempotency-service";
import { enforceCapability } from "@/server/api/beta-controls/guard";

const submissionSchema = z.object({
  amount: stroopAmountSchema,
  messageId: hash32Schema,
  paymentHash: hash32Schema,
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
  asset: z.string().min(1),
  policyVersion: z.number().int().nonnegative(),
  network: z.string().min(1),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  quoteDigest: z.string(),
});

export const Route = createFileRoute("/api/v1/postage/")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const input = await parseJsonBody(request, submissionSchema, {
            route: "POST /postage",
          });
          requireActorMatches(apiContext, input.sender);

          // BETA-095: operator kill switch for postage writes. Fails closed.
          await enforceCapability("postageWrites");

          await verifyQuoteSubmission(apiContext, input);

          const { issuedAt, expiresAt, quoteDigest, ...postageInput } = input;

          const repo = apiContext.repository;

          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";
          const userAgent = request.headers.get("user-agent") ?? undefined;
          const acceptLanguage = request.headers.get("accept-language") ?? undefined;
          const acceptEncoding = request.headers.get("accept-encoding") ?? undefined;
          const relayId = request.headers.get("x-stealth-relay-id") ?? undefined;
          const ipPrefix =
            ip === "unknown"
              ? "unknown"
              : ip.includes(":")
                ? ip.split(":").slice(0, 4).join(":")
                : ip.split(".").slice(0, 3).join(".");
          const fingerprint = buildDeviceFingerprint({
            userAgent,
            acceptLanguage,
            acceptEncoding,
            ipPrefix,
          });
          const submitContext: SubmitPostageContext = {
            actorId: input.sender,
            fingerprint,
            ip,
            relayId,
            sender: input.sender,
          };

          const rawIdempotencyKey = request.headers.get("x-idempotency-key");
          const submit = async () => {
            const postage = await submitPostage(
              apiContext,
              postageInput,
              new Date(),
              submitContext,
            );
            return { status: 201, body: postage };
          };

          const result = rawIdempotencyKey
            ? await withIdempotency(
                repo,
                {
                  actor: input.sender,
                  method: request.method,
                  route: "POST /postage",
                  rawKey: rawIdempotencyKey,
                },
                input,
                submit,
                { cacheableErrorStatuses: [409] },
              )
            : { ...(await submit()), replayed: false };

          return apiSuccess(request, result.body, {
            status: result.status,
            ...(result.replayed ? { headers: { "x-idempotency-replayed": "true" } } : {}),
          });
        }),
    },
  },
});
