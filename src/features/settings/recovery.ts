import { z } from "zod";

/**
 * Issue #1917 (BETA-010): client-facing recovery-code contracts.
 *
 * Deliberately server-import-free (the client bundle is protected from
 * `src/server/**`): these schemas mirror the server's public shapes so the UI
 * can validate its own fetch responses.
 *
 * The status model NEVER carries code material — only aggregate counters and
 * set state. Plaintext codes exist solely in the regeneration response, which
 * the UI displays exactly once and can download as a text file.
 */
export const recoveryStatusSchema = z.object({
  status: z.enum(["none", "active", "exhausted"]),
  totalCodes: z.number().int().min(0),
  remainingCodes: z.number().int().min(0),
  generatedAt: z.string().datetime().nullable(),
});

export type RecoveryStatus = z.infer<typeof recoveryStatusSchema>;

export const recoveryRegenerateResponseSchema = z.object({
  status: z.literal("active"),
  totalCodes: z.number().int().min(0),
  remainingCodes: z.number().int().min(0),
  generatedAt: z.string().datetime().nullable(),
  codes: z.array(z.string().min(1)),
});

export type RecoveryRegenerateResponse = z.infer<typeof recoveryRegenerateResponseSchema>;

export const recoveryUserSchema = z.object({
  userId: z.string(),
  address: z.string(),
  email: z.string(),
  username: z.string(),
  status: z.enum(["active", "pending_verification", "suspended", "deactivated"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const recoverySessionSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  lastActiveAt: z.string().datetime(),
  absoluteExpiresAt: z.string().datetime().optional(),
});

export const recoveryRedeemResponseSchema = z.object({
  user: recoveryUserSchema,
  session: recoverySessionSchema,
});

export type RecoveryRedeemResponse = z.infer<typeof recoveryRedeemResponseSchema>;
