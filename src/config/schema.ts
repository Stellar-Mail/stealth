import { z } from "zod";
import { betaCapabilitySchema, killSwitchStateSchema } from "../server/api/beta-controls/types";

export const configProfileSchema = z.enum(["development", "test", "preview", "production"]);
export type ConfigProfile = z.infer<typeof configProfileSchema>;

export const runtimeRoleSchema = z.enum(["all", "web", "relay", "indexer", "operator"]);
export type RuntimeRole = z.infer<typeof runtimeRoleSchema>;

export const stellarNetworkSchema = z.enum(["testnet", "mainnet", "futurenet", "local"]);
export type StellarNetwork = z.infer<typeof stellarNetworkSchema>;

export const storageDriverSchema = z.enum(["memory", "cloudflare-kv", "hybrid"]);
export type StorageDriver = z.infer<typeof storageDriverSchema>;

/**
 * Validates Stellar contract ID format (C... 56 chars) or test key format.
 */
export const stellarContractIdSchema = z
  .string()
  .min(1, "Contract ID cannot be empty")
  .refine(
    (val) => /^C[A-Z0-9]{55}$/.test(val) || val.startsWith("C_TEST_") || val.startsWith("C_DEV_"),
    {
      message: "Must be a valid Stellar Soroban contract ID (C... 56 characters)",
    },
  );

/**
 * 1. Network Domain Schema
 */
export const networkConfigSchema = z.object({
  network: configProfileSchema,
  stellarNetwork: stellarNetworkSchema,
  horizonUrl: z.string().url("Horizon URL must be a valid HTTP(S) URL"),
  sorobanRpcUrl: z.string().url("Soroban RPC URL must be a valid HTTP(S) URL"),
  networkPassphrase: z.string().min(1, "Network passphrase cannot be empty"),
});
export type NetworkConfig = z.infer<typeof networkConfigSchema>;

/**
 * 2. Storage Domain Schema
 */
export const storageConfigSchema = z.object({
  storageDriver: storageDriverSchema,
  kvNamespaceId: z.string().min(1, "KV Namespace ID cannot be empty"),
  kvBinding: z.unknown().optional(),
  coordinatorBinding: z.unknown().optional(),
});
export type StorageConfig = z.infer<typeof storageConfigSchema>;

/**
 * 3. Session & Security Domain Schema
 */
export const sessionConfigSchema = z.object({
  authChallengeLifetimeMs: z
    .number()
    .int()
    .positive("Auth challenge lifetime must be a positive integer"),
  authClockSkewMs: z.number().int().nonnegative("Auth clock skew must be a non-negative integer"),
  authNonceTtlMs: z.number().int().positive("Auth nonce TTL must be a positive integer"),
  quoteLifetimeMs: z.number().int().positive("Quote lifetime must be a positive integer"),
});
export type SessionConfig = z.infer<typeof sessionConfigSchema>;

/**
 * 4. Relay Domain Schema
 */
export const relayConfigSchema = z.object({
  relayUrl: z.string().url("Relay URL must be a valid HTTP(S) URL"),
  relayTimeoutMs: z.number().int().positive("Relay timeout must be a positive integer"),
});
export type RelayConfig = z.infer<typeof relayConfigSchema>;

/**
 * 5. Contract Domain Schema
 */
export const contractConfigSchema = z.object({
  registryContractId: z.string().min(1, "Registry contract ID cannot be empty"),
  postageContractId: z.string().min(1, "Postage contract ID cannot be empty"),
  lifecycleContractId: z.string().min(1, "Lifecycle contract ID cannot be empty"),
  receiptsContractId: z.string().min(1, "Receipts contract ID cannot be empty"),
  policiesContractId: z.string().min(1, "Policies contract ID cannot be empty"),
  domainTag: z.string().min(1, "Domain tag cannot be empty"),
  protocolVersion: z.string().min(1, "Protocol version cannot be empty"),
});
export type ContractConfig = z.infer<typeof contractConfigSchema>;

/**
 * 6. Origin & CORS Domain Schema
 *
 * BETA-079: Added invite code configuration for controlled beta access.
 * The invite code requirement can be enabled/disabled via configuration
 * without code changes, supporting the transition from beta to open registration.
 */
export const originConfigSchema = z.object({
  appUrl: z.string().url("App URL must be a valid HTTP(S) URL"),
  allowedOrigins: z.array(z.string()).min(1, "At least one allowed CORS origin is required"),
  allowedMethods: z.array(z.string()).min(1, "Allowed CORS methods are required"),
  allowedHeaders: z.array(z.string()).min(1, "Allowed CORS headers are required"),
  allowCredentials: z.boolean(),
  inviteCodeRequired: z.boolean().default(false),
  validInviteCodes: z.array(z.string()).optional(),
});
export type OriginConfig = z.infer<typeof originConfigSchema>;

/**
 * 7. Notifications Domain Schema (BETA-005)
 *
 * Delivery of account verification messages. The transport is pluggable:
 * - "sink" captures messages in memory for local development (never used in
 *   the production path).
 * - "smtp" delivers through a self-hosted SMTP server; no third-party mail
 *   vendor is required.
 */
export const notificationTransportSchema = z.enum(["sink", "smtp"]);
export type NotificationTransport = z.infer<typeof notificationTransportSchema>;

export const smtpConfigSchema = z.object({
  host: z.string().min(1, "SMTP host cannot be empty"),
  port: z.number().int().positive("SMTP port must be a positive integer"),
  secure: z.boolean(),
  startTls: z.boolean(),
  username: z.string().optional(),
  password: z.string().optional(),
});
export type SmtpConfig = z.infer<typeof smtpConfigSchema>;

export const verificationPolicySchema = z.object({
  tokenLifetimeMs: z
    .number()
    .int()
    .positive("Verification token lifetime must be a positive integer"),
  resendCooldownMs: z
    .number()
    .int()
    .positive("Verification resend cooldown must be a positive integer"),
  maxAttempts: z.number().int().positive("Verification max attempts must be a positive integer"),
});
export type VerificationPolicy = z.infer<typeof verificationPolicySchema>;

export const notificationsConfigSchema = z.object({
  transport: notificationTransportSchema,
  fromAddress: z.string().min(1, "Notification from-address cannot be empty"),
  verification: verificationPolicySchema,
  smtp: smtpConfigSchema,
});
export type NotificationsConfig = z.infer<typeof notificationsConfigSchema>;

/**
 * Beta control configuration (BETA-095).
 *
 * Carries the operator-configurable baseline for kill switches, feature flags
 * and the bounded propagation window. This is the *default* baseline only; the
 * live state is mutated at runtime by operators through the admin API and held
 * in the BetaControlService store. If the store cannot be read, enforcement
 * falls back to this baseline (and fail-closed guarantees the capability is
 * disabled when the store is unreachable).
 */
export const betaControlConfigSchema = z.object({
  controlTtlSeconds: z.number().int().positive().default(5),
  killSwitchDefaults: z.record(betaCapabilitySchema, killSwitchStateSchema).default({}),
  featureFlagDefaults: z.record(z.string(), z.boolean()).default({}),
});
export type BetaControlConfig = z.infer<typeof betaControlConfigSchema>;

/**
 * Public Configuration (Client-safe subset with ZERO secrets)
 */
export const publicConfigSchema = z.object({
  profile: configProfileSchema,
  role: runtimeRoleSchema,
  network: networkConfigSchema,
  storage: z.object({
    storageDriver: storageDriverSchema,
    kvNamespaceId: z.string(),
  }),
  session: z.object({
    authChallengeLifetimeMs: z.number(),
    authClockSkewMs: z.number(),
    authNonceTtlMs: z.number(),
    quoteLifetimeMs: z.number(),
  }),
  relay: z.object({
    relayUrl: z.string(),
    relayTimeoutMs: z.number(),
  }),
  contract: contractConfigSchema,
  origin: originConfigSchema,
  notifications: z.object({
    transport: notificationTransportSchema,
    fromAddress: z.string(),
    verification: verificationPolicySchema,
    smtp: z.object({
      host: z.string(),
      port: z.number(),
      secure: z.boolean(),
      startTls: z.boolean(),
    }),
  }),
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;

/**
 * Secret Configuration (Server-only secret parameters)
 */
export const secretConfigSchema = z.object({
  cursorSecret: z.string().optional(),
  operatorSecret: z.string().optional(),
  relayApiKey: z.string().optional(),
  rpcApiKey: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpUsername: z.string().optional(),
  storageSecret: z.string().optional(),
});
export type SecretConfig = z.infer<typeof secretConfigSchema>;

/**
 * Complete Beta Runtime Configuration
 */
export const runtimeConfigSchema = z.object({
  profile: configProfileSchema,
  role: runtimeRoleSchema,
  network: networkConfigSchema,
  storage: storageConfigSchema,
  session: sessionConfigSchema,
  relay: relayConfigSchema,
  contract: contractConfigSchema,
  origin: originConfigSchema,
  notifications: notificationsConfigSchema,
  betaControl: betaControlConfigSchema,
  secrets: secretConfigSchema,
});
export type BetaRuntimeConfig = z.infer<typeof runtimeConfigSchema>;
export type RuntimeConfig = BetaRuntimeConfig;
