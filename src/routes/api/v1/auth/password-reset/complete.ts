import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { completePasswordReset } from "@/server/api/auth/password-reset-service";
import { getApiContext } from "@/server/api/context";
import { emailSchema } from "@/server/api/domain";
import { parseJsonBody } from "@/server/api/request";
import { apiSuccess, handleApiRequest } from "@/server/api/response";

const completeResetSchema = z
  .object({
    token: z.string().trim().min(1, "Token cannot be empty").max(512, "Token is too long"),
    password: z.string().optional(),
    newPassword: z.string().optional(),
    passwordConfirmation: z.string().optional(),
    email: emailSchema.optional(),
  })
  .refine((data) => Boolean(data.password || data.newPassword), {
    message: "Password is required",
    path: ["password"],
  })
  .superRefine((data, ctx) => {
    const effectivePassword = data.password ?? data.newPassword;
    if (data.passwordConfirmation && effectivePassword !== data.passwordConfirmation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["passwordConfirmation"],
      });
    }
  });

/**
 * POST /api/v1/auth/password-reset/complete
 *
 * Completes a password reset with a valid token and new password.
 *
 * Invariants (BETA-009):
 * 1. Token must be valid, unexpired, and not previously consumed.
 * 2. New password must satisfy password policy (min 12 chars, upper, lower, digit).
 * 3. Atomic CAS: racing requests with the same token result in exactly 1 winner.
 * 4. Revokes ALL active sessions for the account across all devices.
 * 5. Invalidates all other outstanding reset tokens for the account.
 */
export const Route = createFileRoute("/api/v1/auth/password-reset/complete")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleApiRequest(request, async () => {
          const apiContext = await getApiContext(request);
          const input = await parseJsonBody(request, completeResetSchema, {
            route: "POST /auth/password-reset/complete" as any,
          });

          const host = request.headers.get("host") ?? undefined;
          const effectivePassword = (input.password ?? input.newPassword)!;

          const result = await completePasswordReset(apiContext, {
            token: input.token,
            newPassword: effectivePassword,
            email: input.email,
            host,
          });

          const response = apiSuccess(request, {
            success: true,
            message: result.message,
          });

          for (const header of result.cookieHeaders) {
            response.headers.append("Set-Cookie", header);
          }

          return response;
        }),
    },
  },
});
