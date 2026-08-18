import { createFileRoute } from "@tanstack/react-router";

import { registrationRequestSchema } from "@/features/identity/registration";
import { enforceAuthRegisterLimits } from "@/server/api/abuse-controls";
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

          const apiContext = await getApiContext(request);

          // BETA-049: enforce IP-level registration budget before account creation
          await enforceAuthRegisterLimits(apiContext.repository, ip, request);

          const result = await registerWithPassword(apiContext, body, ip);
          return apiSuccess(request, result, { status: 201 });
        }),
    },
  },
});
