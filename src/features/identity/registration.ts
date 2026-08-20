import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Expected a valid email address");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_-]{3,30}$/,
    "Username must be 3-30 lowercase alphanumeric characters, underscores, or hyphens",
  );

export const CURRENT_TERMS_VERSION = "2026-01";
export const CURRENT_PRIVACY_POLICY_VERSION = "2026-01";

export const registrationRequestSchema = z
  .object({
    displayName: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
    email: emailSchema,
    username: usernameSchema,
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(256, "Password is too long")
      .refine((value) => /[a-z]/.test(value), "Password must include a lowercase letter")
      .refine((value) => /[A-Z]/.test(value), "Password must include an uppercase letter")
      .refine((value) => /\d/.test(value), "Password must include a number"),
    passwordConfirmation: z.string(),
    termsVersion: z.literal(CURRENT_TERMS_VERSION),
    privacyPolicyVersion: z.literal(CURRENT_PRIVACY_POLICY_VERSION),
    inviteCode: z.string().trim().optional(),
    challengeNonce: z.string().trim().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.password !== value.passwordConfirmation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passwordConfirmation"],
        message: "Passwords do not match",
      });
    }
  });

export const registrationResponseSchema = z.object({
  accountStatus: z.literal("pending_verification"),
  email: emailSchema,
  maskedEmail: z.string(),
  username: usernameSchema,
});

export type RegistrationRequest = z.infer<typeof registrationRequestSchema>;
export type RegistrationResponse = z.infer<typeof registrationResponseSchema>;

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}
