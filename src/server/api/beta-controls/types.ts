import { z } from "zod";

/**
 * BETA-095 — Beta cohort, invitation, feature-flag and kill-switch model.
 *
 * These schemas describe the operator-controlled state that gates risky beta
 * capabilities without requiring a redeploy. The model is intentionally
 * conservative: every capability defaults to "open" only when an explicit
 * configuration baseline says so, and the enforcement layer treats an
 * unavailable control store as closed (fail-closed).
 */

export const BETA_CAPABILITIES = [
  "signup",
  "funding",
  "sending",
  "attachments",
  "postageWrites",
  "receipts",
  "walletLinking",
] as const;

export const betaCapabilitySchema = z.enum(BETA_CAPABILITIES);
export type BetaCapability = z.infer<typeof betaCapabilitySchema>;

export const killSwitchStateSchema = z.enum(["open", "closed"]);
export type KillSwitchState = z.infer<typeof killSwitchStateSchema>;

/**
 * A kill switch record. `closed` means the capability is DISABLED and clients
 * receive a 503 `beta_capability_disabled` until an operator reopens it.
 */
export const killSwitchRecordSchema = z.object({
  capability: betaCapabilitySchema,
  state: killSwitchStateSchema,
  updatedAt: z.string(),
  updatedBy: z.string(),
  reason: z.string().max(500).optional(),
  version: z.number().int().positive(),
});
export type KillSwitchRecord = z.infer<typeof killSwitchRecordSchema>;

export const featureFlagSchema = z.object({
  key: z.string().min(1).max(128),
  enabled: z.boolean(),
  accountAllow: z.array(z.string()).default([]),
  accountDeny: z.array(z.string()).default([]),
  /** 0-100 rollout by stable account hash; null disables percentage rollout. */
  percentage: z.number().int().min(0).max(100).nullable().default(null),
  description: z.string().max(500).default(""),
  expiresAt: z.string().datetime().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  version: z.number().int().positive(),
});
export type FeatureFlag = z.infer<typeof featureFlagSchema>;

export const cohortSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().max(500).default(""),
  /** Maximum number of active invites that may exist for this cohort. */
  inviteLimit: z.number().int().nonnegative().default(0),
  memberAccounts: z.array(z.string()).default([]),
  featureFlags: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  version: z.number().int().positive(),
});
export type Cohort = z.infer<typeof cohortSchema>;

export const inviteStatusSchema = z.enum(["active", "redeemed", "revoked", "expired"]);
export type InviteStatus = z.infer<typeof inviteStatusSchema>;

export const betaInviteSchema = z.object({
  code: z.string().min(1).max(50),
  cohortId: z.string().nullable().default(null),
  status: inviteStatusSchema.default("active"),
  createdAt: z.string(),
  createdBy: z.string(),
  expiresAt: z.string().datetime().nullable().default(null),
  usedBy: z.string().nullable().default(null),
  usedAt: z.string().datetime().nullable().default(null),
  reason: z.string().max(500).optional(),
  version: z.number().int().positive(),
});
export type BetaInvite = z.infer<typeof betaInviteSchema>;

export const betaControlAuditEventSchema = z.object({
  id: z.string(),
  at: z.string(),
  actor: z.string(),
  action: z.string(),
  target: z.string(),
  reason: z.string().optional(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  requestId: z.string().optional(),
  result: z.enum(["success", "denied", "error"]),
});
export type BetaControlAuditEvent = z.infer<typeof betaControlAuditEventSchema>;

export const betaControlSnapshotSchema = z.object({
  killSwitches: z.array(killSwitchRecordSchema),
  flags: z.array(featureFlagSchema),
  cohorts: z.array(cohortSchema),
  invites: z.array(betaInviteSchema),
});
export type BetaControlSnapshot = z.infer<typeof betaControlSnapshotSchema>;
