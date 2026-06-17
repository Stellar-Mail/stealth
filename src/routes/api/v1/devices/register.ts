import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireActor } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import { registerDevice } from "@/server/api/device-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const registerSchema = z.object({
  publicKey: z.string().min(1).max(128),
  userAgent: z.string().optional().default(""),
  acceptLanguage: z.string().optional().default(""),
  acceptEncoding: z.string().optional().default(""),
});

export const Route = createFileRoute("/api/v1/devices/register")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const address = requireActor(request);
          const body = await parseJsonBody(request, registerSchema);
          const ip =
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            request.headers.get("x-real-ip") ??
            "unknown";
          const device = await registerDevice(
            getApiContext().repository,
            address,
            {
              userAgent: body.userAgent,
              acceptLanguage: body.acceptLanguage,
              acceptEncoding: body.acceptEncoding,
              ip,
            },
            body.publicKey,
          );
          return apiSuccess(request, { device });
        }),
    },
  },
});
