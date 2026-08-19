import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getApiContext } from "@/server/api/context";
import { emailSchema } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";
import { verifyEmailVerificationToken } from "@/server/api/verification-service";

const verifySchema = z.object({
  email: emailSchema,
  token: z.string().trim().min(1, "Token cannot be empty").max(512, "Token is too long"),
});

/**
 * POST /api/v1/auth/verify
 *
 * Verifies an account using the token delivered to the account email.
 *
 * Generic-response contract (BETA-005): the response never reveals whether an
 * account exists — every failure is expressed as token state (`reason`), and
 * replaying an already-verified token against an active account reports
 * success, so duplicate clicks and retries are safe.
 */
export const Route = createFileRoute("/api/v1/auth/verify")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const input = await parseJsonBody(request, verifySchema, {
            route: "POST /auth/verify",
          });

          const outcome = await verifyEmailVerificationToken(apiContext, input.email, input.token);

          if (outcome.outcome === "verified") {
            return apiSuccess(request, { verified: true });
          }
          return apiSuccess(request, {
            verified: false,
            reason: outcome.reason,
          });
        }),
    },
  },
});
