import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { emailSchema } from "@/server/api/domain";
import { ApiError } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  getVerificationDeliveryConfig,
  getVerificationNotificationAdapter,
} from "@/server/api/verification-delivery";
import { resendEmailVerificationToken } from "@/server/api/verification-service";

const resendSchema = z.object({
  email: emailSchema,
});

/**
 * POST /api/v1/auth/resend-verification
 *
 * Re-sends the verification message for a pending account.
 *
 * Generic-response contract (BETA-005): unknown emails and accounts that are
 * not pending verification receive the exact same `{ status: "sent" }`
 * response as a successful resend, so the endpoint cannot be used to probe
 * which addresses have accounts. The only observable divergence is the
 * resend cooldown (429), which protects against spam and token churn.
 */
export const Route = createFileRoute("/api/v1/auth/resend-verification")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const input = await parseJsonBody(request, resendSchema, {
            route: "POST /auth/resend-verification",
          });

          const delivery = await getVerificationDeliveryConfig();
          const adapter = await getVerificationNotificationAdapter();

          const outcome = await resendEmailVerificationToken(
            apiContext,
            input.email,
            delivery.notifications.verification,
            (message) => adapter.deliverVerificationEmail(message),
            delivery.appUrl,
          );

          switch (outcome.outcome) {
            case "sent":
            case "noop":
              return apiSuccess(request, { status: "sent" });
            case "cooldown":
              throw new ApiError(
                429,
                "too_many_requests",
                "Verification resend is still on cooldown",
                { retryAfterSeconds: outcome.retryAfterSeconds },
              );
            case "delivery_failed":
              throw new ApiError(
                503,
                "dependency_unavailable",
                "The verification message could not be delivered",
              );
          }
        }),
    },
  },
});
