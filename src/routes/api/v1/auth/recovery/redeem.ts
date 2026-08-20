import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { redeemRecoveryCode } from "@/server/api/auth/recovery";
import { getApiContext } from "@/server/api/context";
import { toPublicSession, toPublicUser } from "@/server/api/domain";
import { withIdempotency } from "@/server/api/idempotency-service";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const redeemRecoveryCodeSchema = z.object({
  identifier: z.string().trim().min(1, "Identifier is required"),
  code: z.string().trim().min(1, "Recovery code is required"),
});

interface RedeemResponseBody {
  user: ReturnType<typeof toPublicUser>;
  session: ReturnType<typeof toPublicSession>;
}

export const Route = createFileRoute("/api/v1/auth/recovery/redeem")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const body = await parseJsonBody(request, redeemRecoveryCodeSchema, "compact");

          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";
          const userAgent = request.headers.get("user-agent") ?? undefined;

          const repo = apiContext.repository;
          const rawIdempotencyKey = request.headers.get("x-idempotency-key");

          const redeem = async (): Promise<{
            status: number;
            body: RedeemResponseBody;
            setCookie: string;
          }> => {
            const result = await redeemRecoveryCode(
              apiContext,
              { identifier: body.identifier, code: body.code },
              { ip, userAgent },
            );
            return {
              status: 200,
              body: {
                user: toPublicUser(result.user),
                session: toPublicSession(result.session),
              },
              setCookie: result.cookieHeader,
            };
          };

          const result = rawIdempotencyKey
            ? await withIdempotency(
                repo,
                {
                  actor: body.identifier.trim().toLowerCase(),
                  method: request.method,
                  route: "POST /auth/recovery/redeem",
                  rawKey: rawIdempotencyKey,
                },
                body,
                redeem,
              )
            : { ...(await redeem()), replayed: false };

          // The session cookie is only issued by the request that actually
          // consumed the code; an idempotent replay reuses the body the client
          // already received (and whose cookie it already stored).
          const headers: HeadersInit = result.replayed
            ? { "x-idempotency-replayed": "true" }
            : { "Set-Cookie": (result as { setCookie?: string }).setCookie ?? "" };

          return apiSuccess(request, result.body, {
            status: result.status,
            headers,
          });
        }),
    },
  },
});
