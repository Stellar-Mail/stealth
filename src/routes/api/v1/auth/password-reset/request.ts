import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requestPasswordReset } from "@/server/api/auth/password-reset-service";
import { getApiContext } from "@/server/api/context";
import { emailSchema } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  getVerificationDeliveryConfig,
  getVerificationNotificationAdapter,
} from "@/server/api/verification-delivery";

const requestResetSchema = z.object({
  email: emailSchema,
});

/**
 * POST /api/v1/auth/password-reset/request
 *
 * Requests a password reset email for an account.
 *
 * Generic-response contract (BETA-009): Responds identically with { status: "sent" }
 * regardless of whether the account exists (enumeration-resistant). Cooldowns and
 * IP-based rate limiting are enforced to prevent brute-force attacks and abuse.
 */
export const Route = createFileRoute("/api/v1/auth/password-reset/request")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const input = await parseJsonBody(request, requestResetSchema, {
            route: "POST /auth/password-reset/request" as any,
          });

          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";

          const delivery = await getVerificationDeliveryConfig();
          const adapter = await getVerificationNotificationAdapter();

          const result = await requestPasswordReset(
            apiContext,
            {
              email: input.email,
              ip,
            },
            (message) => adapter.deliverVerificationEmail(message),
            delivery.appUrl,
          );

          return apiSuccess(request, { status: result.status });
        }),
    },
  },
});
