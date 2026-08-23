import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  checkVerificationTokenAbuse,
  recordVerificationTokenFailure,
} from "@/server/api/abuse-service";
import { getApiContext } from "@/server/api/context";
import { emailSchema } from "@/server/api/domain";
import { ApiError } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { verifyEmailVerificationToken } from "@/server/api/verification-service";

const verifySchema = z.object({
  email: emailSchema,
  token: z.string().trim().min(1, "Token cannot be empty").max(512, "Token is too long"),
});

export const Route = createFileRoute("/api/v1/auth/verify")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const input = await parseJsonBody(request, verifySchema, {
            route: "POST /auth/verify",
          });

          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";

          const tokenKey = `${input.email}:${input.token.slice(0, 8)}`;
          const abuseCheck = await checkVerificationTokenAbuse(apiContext.repository, tokenKey, ip);
          if (!abuseCheck.allowed) {
            throw new ApiError(429, "too_many_requests", "Token verification limit exceeded", {
              retryAfterSeconds: abuseCheck.retryAfterSeconds ?? 3600,
            });
          }

          const outcome = await verifyEmailVerificationToken(apiContext, input.email, input.token);

          if (outcome.outcome === "verified") {
            return apiSuccess(request, { verified: true });
          }

          await recordVerificationTokenFailure(apiContext.repository, tokenKey);

          return apiSuccess(request, {
            verified: false,
            reason: outcome.reason,
          });
        }),
    },
  },
});
