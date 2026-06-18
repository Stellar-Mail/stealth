import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema, stellarAddressSchema, stroopAmountSchema } from "@/server/api/domain";
import { buildDeviceFingerprint } from "@/server/api/abuse-service";
import { submitPostage, type SubmitPostageContext } from "@/server/api/postage-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { checkIdempotency, recordIdempotency } from "@/server/api/idempotency-service";

const submissionSchema = z.object({
  amount: stroopAmountSchema,
  messageId: hash32Schema,
  paymentHash: hash32Schema,
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
});

export const Route = createFileRoute("/api/v1/postage/")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const input = await parseJsonBody(request, submissionSchema);
          requireActorMatches(request, input.sender);

          const repo = getApiContext().repository;
          const rawIdempotencyKey = request.headers.get("x-idempotency-key");
          if (rawIdempotencyKey) {
            const existing = await checkIdempotency(repo, input.sender, rawIdempotencyKey);
            if (existing) {
              return apiSuccess(request, existing.body, {
                status: existing.status,
                headers: { "x-idempotency-replayed": "true" },
              });
            }
          }

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
          const context: SubmitPostageContext = {
            actorId: input.sender,
            fingerprint,
            ip,
            relayId,
            sender: input.sender,
          };
          const postage = await submitPostage(repo, input, new Date(), context);

          if (rawIdempotencyKey) {
            await recordIdempotency(repo, input.sender, rawIdempotencyKey, 201, postage);
          }

          return apiSuccess(request, postage, { status: 201 });
        }),
    },
  },
});
