import { createFileRoute } from "@tanstack/react-router";

import { registrationRequestSchema } from "@/features/identity/registration";
import { buildDeviceFingerprint } from "@/server/api/abuse-service";
import { registerWithPassword } from "@/server/api/auth/registration-service";
import { getApiContext } from "@/server/api/context";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import {
  getVerificationDeliveryConfig,
  getVerificationNotificationAdapter,
} from "@/server/api/verification-delivery";
import { loadRuntimeConfig } from "@/config";

export const Route = createFileRoute("/api/v1/auth/register")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const body = await parseJsonBody(request, registrationRequestSchema, "compact");
          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";
          const fingerprint = buildDeviceFingerprint({
            userAgent: request.headers.get("user-agent") ?? undefined,
            acceptLanguage: request.headers.get("accept-language") ?? undefined,
            acceptEncoding: request.headers.get("accept-encoding") ?? undefined,
            ipPrefix: ip.split(".").slice(0, 3).join("."),
          });
          const delivery = await getVerificationDeliveryConfig();
          const adapter = await getVerificationNotificationAdapter();

          // BETA-079: Load invite code configuration from runtime config
          const runtimeConfig = loadRuntimeConfig();
          const inviteCodeRequired = runtimeConfig.origin?.inviteCodeRequired ?? false;
          const validInviteCodes = runtimeConfig.origin?.validInviteCodes;

          const result = await registerWithPassword(
            await getApiContext(request),
            body,
            ip,
            fingerprint,
            {
              appUrl: delivery.appUrl,
              verificationPolicy: delivery.notifications.verification,
              deliver: (message) => adapter.deliverVerificationEmail(message),
              inviteCodeRequired,
              validInviteCodes,
            },
          );
          return apiSuccess(request, result, { status: 201 });
        }),
    },
  },
});
