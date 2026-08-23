import { createFileRoute } from "@tanstack/react-router";

import { registrationRequestSchema } from "@/features/identity/registration";
import { buildDeviceFingerprint } from "@/server/api/abuse-service";
import { registerWithPassword } from "@/server/api/auth/registration-service";
import { getApiContext } from "@/server/api/context";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

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
          const result = await registerWithPassword(
            await getApiContext(request),
            body,
            ip,
            fingerprint,
          );
          return apiSuccess(request, result, { status: 201 });
        }),
    },
  },
});
