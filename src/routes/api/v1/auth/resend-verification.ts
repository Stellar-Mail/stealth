import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { checkPasswordResetAbuse } from "@/server/api/abuse-service";
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

export const Route = createFileRoute("/api/v1/auth/resend-verification")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const input = await parseJsonBody(request, resendSchema, {
            route: "POST /auth/resend-verification",
          });

          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";

          const abuseCheck = await checkPasswordResetAbuse(apiContext.repository, input.email, ip);
          if (!abuseCheck.allowed) {
            throw new ApiError(
              429,
              "too_many_requests",
              "Verification resend rate limit exceeded",
              { retryAfterSeconds: abuseCheck.retryAfterSeconds ?? 3600 },
            );
          }

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
