import { z } from "zod";

export const accountStatusSchema = z.enum([
  "pending_verification",
  "active",
  "suspended",
  "deactivated",
]);

export const stellarAddressSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^G[A-Z2-7]{55}$/, "Expected a Stellar G-address");

export const mailboxPolicySchema = z.object({
  allowUnknown: z.boolean(),
  minimumPostage: z.string(),
  requireVerified: z.boolean(),
});

export const publicProfileSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type MailboxPolicy = z.infer<typeof mailboxPolicySchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;

/**
 * Resolution freshness and provenance metadata.
 */
export const resolutionFreshnessSchema = z.object({
  resolvedAt: z.string().datetime(),
  cached: z.boolean(),
  ttlMs: z.number().int().nonnegative(),
  source: z.enum(["stealth_local", "stellar_federation", "direct_address", "negative_cache"]),
  expiresAt: z.string().datetime(),
});

export type ResolutionFreshness = z.infer<typeof resolutionFreshnessSchema>;

/**
 * Enumeration-safe resolution error description.
 */
export const resolutionErrorSchema = z.object({
  code: z.enum([
    "not_found",
    "suspended",
    "deactivated",
    "pending_verification",
    "timeout",
    "invalid_format",
    "network_error",
  ]),
  message: z.string(),
});

export type ResolutionError = z.infer<typeof resolutionErrorSchema>;

/**
 * Complete resolved identity object returned by the production resolver.
 */
export const resolvedIdentitySchema = z.object({
  identifier: z.string(),
  canonicalAddress: z.string(),
  account: stellarAddressSchema.nullable(),
  resolved: z.boolean(),
  status: accountStatusSchema.or(z.literal("unknown")),
  publicKey: z.string().nullable(),
  encryptionKeyVersion: z.number().int().nonnegative().nullable(),
  policyEndpoint: z.string().nullable(),
  policy: mailboxPolicySchema.nullable().optional(),
  profile: publicProfileSchema.nullable().optional(),
  memo: z.string().optional(),
  memoType: z.enum(["text", "id", "hash"]).optional(),
  freshness: resolutionFreshnessSchema,
  error: resolutionErrorSchema.optional(),
});

export type ResolvedIdentity = z.infer<typeof resolvedIdentitySchema>;

/**
 * Input query for identity resolution.
 */
export const resolveIdentityRequestSchema = z.object({
  identifier: z.string().min(1, "Identifier is required").max(300, "Identifier too long"),
  timeoutMs: z.number().int().positive().max(30000).optional(),
  bypassCache: z.boolean().optional(),
});

export type ResolveIdentityRequest = z.infer<typeof resolveIdentityRequestSchema>;
