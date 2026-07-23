import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActorMatches } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { hash32Schema, stellarAddressSchema, stroopAmountSchema } from "@/server/api/domain";
import { buildDeviceFingerprint } from "@/server/api/abuse-service";
import { submitPostage, signQuote, type SubmitPostageContext } from "@/server/api/postage-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { acquireIdempotency, recordIdempotency } from "@/server/api/idempotency-service";
import { ApiError } from "@/server/api/errors";

const submissionSchema = z.object({
  amount: stroopAmountSchema,
  messageId: hash32Schema,
  paymentHash: hash32Schema,
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
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

          if (new Date(input.expiresAt) < new Date()) {
            throw new ApiError(422, "validation_error", "Quote has expired");
          }

          const expectedDigest = signQuote(
            input.recipient,
            input.sender,
            input.amount,
            input.issuedAt,
            input.expiresAt,
          );
          if (expectedDigest !== input.quoteDigest) {
            throw new ApiError(422, "validation_error", "Quote digest is invalid or tampered");
          }

          const { issuedAt, expiresAt, quoteDigest, ...postageInput } = input;

          const repo = apiContext.repository;
          const rawIdempotencyKey = request.headers.get("x-idempotency-key");
          if (rawIdempotencyKey) {
            const result = await acquireIdempotency(repo, input.sender, rawIdempotencyKey);
            if (result.status === "completed") {
              return apiSuccess(request, result.record.body, {
                status: result.record.status,
                headers: { "x-idempotency-replayed": "true" },
              });
            }
            if (result.status === "in_progress") {
              throw new ApiError(409, "conflict", "Request is already in progress");
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
          const submitContext: SubmitPostageContext = {
            actorId: input.sender,
            fingerprint,
            ip,
            relayId,
            sender: input.sender,
          };
          const postage = await submitPostage(repo, postageInput, new Date(), submitContext);

          if (rawIdempotencyKey) {
            await recordIdempotency(repo, input.sender, rawIdempotencyKey, 201, postage);
          }

          return apiSuccess(request, postage, { status: 201 });
        }),
    },
  },
});
