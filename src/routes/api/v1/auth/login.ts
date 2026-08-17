import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { buildDeviceFingerprint } from "@/server/api/abuse-service";
import { authenticateWithPassword, parseSessionCookie } from "@/server/api/auth/session-service";
import { getApiContext } from "@/server/api/context";
import { toPublicSession, toPublicUser } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Identifier is required"),
  password: z.string().min(1, "Password is required"),
});

export const Route = createFileRoute("/api/v1/auth/login")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const body = await parseJsonBody(request, loginSchema, {
            route: "POST /auth/login" as any,
          });

          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";
          const userAgent = request.headers.get("user-agent") ?? undefined;
          const acceptLanguage = request.headers.get("accept-language") ?? undefined;
          const acceptEncoding = request.headers.get("accept-encoding") ?? undefined;
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

          const currentSessionId = parseSessionCookie(request.headers.get("cookie")) ?? undefined;

          const result = await authenticateWithPassword(apiContext, {
            identifier: body.identifier,
            password: body.password,
            ip,
            userAgent,
            deviceFingerprint: fingerprint,
            currentSessionId,
          });

          return apiSuccess(
            request,
            {
              user: toPublicUser(result.user),
              session: toPublicSession(result.session),
            },
            {
              status: 200,
              headers: {
                "Set-Cookie": result.cookieHeader,
              },
            },
          );
        }),
    },
  },
});
