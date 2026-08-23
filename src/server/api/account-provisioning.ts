import { randomUUID } from "node:crypto";

import type { BetaRuntimeConfig } from "../../config/schema";
import { loadRuntimeConfig } from "../../config";
import type { StellarFundingAdapter } from "@/services/stellar/funding-adapter";
import { createFundingAdapter } from "@/services/stellar/funding-adapter";
import { runFundingOperation } from "@/services/stellar/funding";
import { consumeProvisioningQuota } from "./rate-limit";
import {
  assertTestnetManagedWalletNetwork,
  prepareManagedWalletSecret,
  type PreparedManagedWallet,
} from "../../services/stellar/account-provision";
import type {
  AccountStatus,
  ChainMailboxPolicy,
  ManagedWalletRecord,
  Profile,
  ProvisioningFailure,
  ProvisioningRecord,
  ProvisioningStep,
  ProvisioningStatus,
  PublicManagedWallet,
  User,
  Wallet,
} from "./domain";
import { stellarAddressSchema, toPublicManagedWallet, usernameSchema } from "./domain";
import {
  betaDefaultMailboxPolicy,
  getMailboxPolicy,
  getPolicyWriteIntent,
  setMailboxPolicy,
  toChainMailboxPolicy,
} from "./policy-service";
import type { ApiRepository, UpdateProvisioningResult } from "./repository";
import { ApiError } from "./errors";

// ---------------------------------------------------------------------------
// BETA-015 (Issue #1922) — system-managed Stellar testnet wallet provisioning
// ---------------------------------------------------------------------------

export interface ProvisionManagedStellarWalletResult {
  wallet: PublicManagedWallet;
}

export interface ProvisionManagedStellarWalletOptions {
  fundingAdapter: StellarFundingAdapter;
  storageSecret: string;
  now?: Date;
  /** When supplied (e.g. during registration), skip fresh keypair generation. */
  prepared?: PreparedManagedWallet;
  /** Account subject for BETA-018 provisioning quotas. Defaults to `userId`. */
  accountId?: string;
  /** Request origin / IP for BETA-018 per-origin provisioning quotas. */
  origin?: string;
}

function managedWalletKeyRef(userId: string): string {
  return `wallet:managed:${userId}`;
}

/**
 * Idempotently provisions a system-managed Stellar testnet wallet for `userId`.
 */
export async function provisionManagedStellarWallet(
  repository: ApiRepository,
  userId: string,
  config: BetaRuntimeConfig,
  options: ProvisionManagedStellarWalletOptions,
): Promise<ProvisionManagedStellarWalletResult> {
  try {
    assertTestnetManagedWalletNetwork(config);
  } catch {
    throw new ApiError(
      400,
      "bad_request",
      "Managed wallet provisioning is testnet-only during beta",
    );
  }

  const storageSecret = options.storageSecret?.trim();
  if (!storageSecret) {
    throw new ApiError(500, "internal_error", "Managed wallet storage secret is not configured");
  }

  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const existing = await repository.getManagedWallet(userId);

  if (existing?.fundingStatus === "funded") {
    return {
      wallet: toPublicManagedWallet(existing, false),
    };
  }

  const quota = await consumeProvisioningQuota(repository, {
    accountId: options.accountId ?? userId,
    origin: options.origin ?? "unknown",
  });
  if (!quota.allowed) {
    throw new ApiError("too_many_requests", {
      retryAfterSeconds: quota.retryAfterSeconds,
      limitedBy: quota.limitedBy,
    });
  }

  if (existing) {
    const wallet = await ensureManagedWalletFunded(
      existing,
      options.fundingAdapter,
      repository,
      now,
    );
    return {
      wallet: toPublicManagedWallet(wallet, false),
    };
  }

  const prepared =
    options.prepared ??
    (await prepareManagedWalletSecret({
      userId,
      storageSecret,
      now,
    }));

  const pendingRecord: ManagedWalletRecord = {
    userId,
    address: prepared.address,
    network: "testnet",
    fundingStatus: "pending",
    encryptedSecret: prepared.encryptedSecret,
    fundedAt: null,
    createdAt: prepared.createdAt,
    updatedAt: prepared.updatedAt,
    lastError: null,
  };

  const created = await repository.createManagedWalletIfAbsent(pendingRecord);
  const stored =
    created.outcome === "existing"
      ? created.wallet
      : await bindManagedWalletCredential(repository, userId, created.wallet, nowIso);

  const wallet = await ensureManagedWalletFunded(stored, options.fundingAdapter, repository, now);
  return {
    wallet: toPublicManagedWallet(wallet, created.outcome === "created"),
  };
}

async function bindManagedWalletCredential(
  repository: ApiRepository,
  userId: string,
  wallet: ManagedWalletRecord,
  nowIso: string,
): Promise<ManagedWalletRecord> {
  const credential = await repository.getCredential(userId);
  if (credential && credential.walletKeyRef.startsWith("pending_")) {
    await repository.setCredential({
      ...credential,
      walletKeyRef: managedWalletKeyRef(userId),
      updatedAt: nowIso,
    });
  }
  return wallet;
}

async function ensureManagedWalletFunded(
  wallet: ManagedWalletRecord,
  fundingAdapter: StellarFundingAdapter,
  repository: ApiRepository,
  now: Date,
): Promise<ManagedWalletRecord> {
  if (wallet.fundingStatus === "funded") {
    return wallet;
  }

  const operation = await runFundingOperation({
    repository,
    adapter: fundingAdapter,
    userId: wallet.userId,
    address: wallet.address,
    now,
  });

  if (operation.status === "succeeded") {
    return repository.setManagedWallet({
      ...wallet,
      fundingStatus: "funded",
      fundedAt: wallet.fundedAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
      lastError: null,
    });
  }

  if (operation.status === "failed") {
    return repository.setManagedWallet({
      ...wallet,
      fundingStatus: "failed",
      updatedAt: now.toISOString(),
      lastError: operation.lastError,
    });
  }

  return repository.setManagedWallet({
    ...wallet,
    fundingStatus: "pending",
    updatedAt: now.toISOString(),
    lastError: operation.lastError,
  });
}

// ---------------------------------------------------------------------------
// BETA-023 (Issue #1930) — privacy-safe mailbox policy defaults during
// provisioning.
// ---------------------------------------------------------------------------

export interface InitializePolicyDefaultsResult {
  /** False when the owner already had a (possibly customized) policy. */
  provisioned: boolean;
  policy: ChainMailboxPolicy;
  source: "default" | "configured";
  offchainVersion: number | null;
  scheduled: boolean;
}

/**
 * Idempotently initializes the privacy-safe beta mailbox policy defaults for
 * `owner`.
 */
export async function initializeMailboxPolicyDefaults(
  repository: ApiRepository,
  owner: string,
  now = new Date(),
): Promise<InitializePolicyDefaultsResult> {
  const existing = await getMailboxPolicy(repository, owner);
  const intent = await getPolicyWriteIntent(repository, owner);

  if (existing.source === "configured") {
    return {
      provisioned: false,
      policy: toChainMailboxPolicy(existing.policy, intent?.policy.requireReceipt),
      source: "configured",
      offchainVersion: intent?.offchainVersion ?? null,
      scheduled: false,
    };
  }

  const result = await setMailboxPolicy(
    repository,
    owner,
    {
      allowUnknown: betaDefaultMailboxPolicy.allowUnknown,
      requireVerified: betaDefaultMailboxPolicy.requireVerified,
      minimumPostage: betaDefaultMailboxPolicy.minimumPostage,
    },
    { requireReceipt: betaDefaultMailboxPolicy.requireReceipt },
  );

  const scheduled = await getPolicyWriteIntent(repository, owner);
  return {
    provisioned: true,
    policy: scheduled?.policy ?? betaDefaultMailboxPolicy,
    source: "default",
    offchainVersion: scheduled?.offchainVersion ?? null,
    scheduled: scheduled !== null,
  };
}

// ---------------------------------------------------------------------------
// BETA-014 (Issue #1921) - transactional account-provisioning orchestrator
// ---------------------------------------------------------------------------

export const PROVISIONING_STEPS = [
  "username_reservation",
  "profile_defaults",
  "wallet_creation",
  "mailbox_policy_init",
] as const satisfies readonly ProvisioningStep[];

/** Attempts before a transiently failing flow becomes terminal "failed". */
export const MAX_PROVISIONING_ATTEMPTS = 5;

/** Lease length for the username claim held for the duration of provisioning. */
export const USERNAME_RESERVATION_LEASE_MS = 30 * 60 * 1000;

export interface ProvisionAccountInput {
  /** The account address that owns this provisioning (the actor). */
  address: string;
  /** Username to claim; must match the user's bound username when one exists. */
  username: string;
  /** Required only when no user record exists yet (signup bootstrap). */
  email?: string;
  /** Optional display-name default for the profile. */
  displayName?: string | null;
}

/** Safe progress projection: never exposes secrets, hashes, or seeds. */
export interface ProvisioningProgress {
  status: ProvisioningStatus;
  requestedUsername: string;
  completedSteps: ProvisioningStep[];
  currentStep: ProvisioningStep;
  attempts: number;
  failure: ProvisioningFailure | null;
  updatedAt: string;
}

interface StepFailure {
  permanent: boolean;
  code: string;
  message: string;
}

/**
 * A taken username is a *deterministic* conflict: no retry can make it
 * available, so the flow must land in terminal "failed" even though the
 * generic `conflict` code is registered as retryable. The 409 + `conflict`
 * surface mirrors the coordinator/memory-repository convention for usernames
 * already bound to another account.
 */
class ProvisionUsernameConflictError extends ApiError {
  constructor(username: string) {
    super(409, "conflict", `Username "${username}" is not available`);
  }
}

function classifyFailure(error: unknown): StepFailure {
  if (error instanceof ApiError) {
    const permanent = !error.retryable || error instanceof ProvisionUsernameConflictError;
    return { permanent, code: error.code, message: error.message };
  }
  return {
    permanent: false,
    code: "internal_error",
    message: "Provisioning step failed unexpectedly",
  };
}

function firstIncompleteStep(record: ProvisioningRecord): ProvisioningStep {
  const next = PROVISIONING_STEPS.find((step) => !record.completedSteps.includes(step));
  return next ?? PROVISIONING_STEPS[PROVISIONING_STEPS.length - 1];
}

function toProgress(record: ProvisioningRecord): ProvisioningProgress {
  return {
    status: record.status,
    requestedUsername: record.requestedUsername,
    completedSteps: [...record.completedSteps],
    currentStep: record.currentStep,
    attempts: record.attempts,
    failure: record.failure ? { ...record.failure } : null,
    updatedAt: record.updatedAt,
  };
}

async function persist(
  repository: ApiRepository,
  record: ProvisioningRecord,
): Promise<ProvisioningRecord> {
  const result: UpdateProvisioningResult = await repository.setProvisioningRecord(
    record,
    record.version,
  );
  if (!result.updated) {
    throw new ApiError(
      409,
      "conflict",
      "Provisioning state changed concurrently; reconcile before proceeding",
    );
  }
  return result.record;
}

/**
 * Applies the failure policy: transient failures become "retryable" (the
 * account stays pending and compensation releases the username claim);
 * permanent failures or exhausted attempts become terminal "failed".
 * Returns the persisted record in its new state.
 */
async function markFailure(
  repository: ApiRepository,
  record: ProvisioningRecord,
  step: ProvisioningStep,
  failure: StepFailure,
  now: Date,
): Promise<ProvisioningRecord> {
  const attempts = record.attempts + 1;
  const terminal = failure.permanent || attempts >= MAX_PROVISIONING_ATTEMPTS;

  const next: ProvisioningRecord = {
    ...record,
    status: terminal ? "failed" : "retryable",
    currentStep: step,
    attempts,
    failure: {
      step,
      code: failure.code,
      message: failure.message,
      failedAt: now.toISOString(),
    },
  };

  const persisted = await persist(repository, next);

  // Compensation: the username claim is the only reversible side effect of
  // the flow. Releasing it on every failure guarantees a retry can re-claim
  // it and a dead account never squats a username forever.
  await repository.releaseUsernameReservation(record.requestedUsername, record.userId);

  return persisted;
}

/**
 * Runs every incomplete step in order, then activates the account.
 * Each step resolves the user record it needs; the first step may bootstrap
 * the user itself, so the flow must not assume the user exists up front.
 */
async function runFlow(
  repository: ApiRepository,
  record: ProvisioningRecord,
  input: ProvisionAccountInput,
  now: Date,
): Promise<ProvisioningRecord> {
  let current = record;

  // Point the progress marker at the first step that still needs to run so a
  // resumed or retried flow reports where it actually is.
  const marker = firstIncompleteStep(current);
  if (current.currentStep !== marker) {
    current = await persist(repository, { ...current, currentStep: marker });
  }

  for (const step of PROVISIONING_STEPS) {
    if (current.completedSteps.includes(step)) continue;

    try {
      await executeStep(repository, step, current, input, now);
    } catch (error) {
      return markFailure(repository, current, step, classifyFailure(error), now);
    }

    current = await persist(repository, {
      ...current,
      completedSteps: [...current.completedSteps, step],
      failure: null,
    });
  }

  // All steps durable: the account may now become active. A concurrent
  // version bump on the user (CAS failure) is a transient conflict — the
  // flow lands in retryable and activation is re-attempted on retry.
  const user = await repository.getUserById(current.userId);
  if (!user) {
    return markFailure(
      repository,
      current,
      PROVISIONING_STEPS[PROVISIONING_STEPS.length - 1],
      {
        permanent: false,
        code: "data_integrity_error",
        message: "The user record for this provisioning no longer exists",
      },
      now,
    );
  }

  try {
    await activateAccount(repository, user, now);
  } catch (error) {
    return markFailure(
      repository,
      current,
      PROVISIONING_STEPS[PROVISIONING_STEPS.length - 1],
      classifyFailure(error),
      now,
    );
  }

  const activated = await persist(repository, { ...current, status: "active", failure: null });

  // The username is now permanently bound through the user record, so the
  // short-lived claim is no longer needed. Best-effort release keeps failed
  // and successful flows symmetric and never squats the username.
  await repository.releaseUsernameReservation(record.requestedUsername, record.userId);

  return activated;
}

async function executeStep(
  repository: ApiRepository,
  step: ProvisioningStep,
  record: ProvisioningRecord,
  input: ProvisionAccountInput,
  now: Date,
): Promise<void> {
  switch (step) {
    case "username_reservation":
      await reserveUsernameStep(repository, record, input, now);
      return;
    case "profile_defaults":
      await profileDefaultsStep(repository, record, now);
      return;
    case "wallet_creation":
      await walletCreationStep(repository, record.userId, now);
      return;
    case "mailbox_policy_init":
      await mailboxPolicyInitStep(repository, record.userId, now);
      return;
  }
}

async function requireUser(repository: ApiRepository, userId: string): Promise<User> {
  const user = await repository.getUserById(userId);
  if (!user) {
    throw new ApiError(
      500,
      "data_integrity_error",
      "The user record for this provisioning no longer exists",
    );
  }
  return user;
}

/**
 * Claims the requested username and bootstraps the user record when no
 * account exists for the actor yet (BETA-004 signup is not merged, so the
 * orchestrator owns convergence of the user record itself). When the user
 * already exists, the bound username is authoritative and the claim is a
 * no-op.
 */
async function reserveUsernameStep(
  repository: ApiRepository,
  record: ProvisioningRecord,
  input: ProvisionAccountInput,
  now: Date,
): Promise<void> {
  const existingUser = await repository.getUserById(record.userId);

  if (existingUser) {
    if (existingUser.username !== record.requestedUsername) {
      throw new ApiError(
        409,
        "invalid_state_transition",
        "The requested username does not match the registered account username",
      );
    }
    return;
  }

  const username = record.requestedUsername;
  if (!input.email) {
    throw new ApiError(422, "validation_error", "Email is required to bootstrap an account");
  }

  const reservation = await repository.reserveUsername(
    username,
    record.userId,
    USERNAME_RESERVATION_LEASE_MS,
  );
  if (reservation.outcome === "unavailable") {
    throw new ProvisionUsernameConflictError(username);
  }

  try {
    await repository.createUser({
      userId: record.userId,
      address: input.address,
      email: input.email,
      username,
      status: "pending_verification",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      version: 1,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "conflict") {
      // The reservation said the username was claimable, so a conflict means
      // the account is in an inconsistent state — no retry fixes that.
      throw new ProvisionUsernameConflictError(username);
    }
    throw error;
  }
}

async function profileDefaultsStep(
  repository: ApiRepository,
  record: ProvisioningRecord,
  now: Date,
): Promise<void> {
  const user = await requireUser(repository, record.userId);
  const existing = await repository.getProfile(user.userId);
  if (existing) return;

  const profile: Profile = {
    userId: user.userId,
    username: user.username,
    displayName: record.displayName ?? user.username,
    locale: "en-US",
    timezone: "UTC",
    addressDisplay: "full",
    avatarUrl: null,
    bio: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await repository.setProfile(profile);
}

/**
 * BETA-015: generate and fund a system-managed testnet wallet (encrypted at
 * rest). The public Wallet row stays bound to the account's existing address so
 * identity lookups and BETA-014 tests remain stable.
 */
async function walletCreationStep(
  repository: ApiRepository,
  userId: string,
  now: Date,
): Promise<void> {
  const user = await requireUser(repository, userId);
  const config = loadRuntimeConfig();
  const storageSecret = config.secrets?.storageSecret ?? "dev-storage-secret-change-me";
  await provisionManagedStellarWallet(repository, userId, config, {
    fundingAdapter: createFundingAdapter({
      useFake: config.profile === "development" || config.profile === "test",
    }),
    storageSecret,
    now,
  });

  const wallet: Wallet = {
    walletId: `wallet_${user.userId}`,
    userId: user.userId,
    address: user.address,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  const result = await repository.createWallet(wallet);
  if (result.outcome === "already-exists" && result.wallet.userId !== user.userId) {
    throw new ApiError(
      500,
      "data_integrity_error",
      "A wallet for another account is bound to this user",
    );
  }
}

async function mailboxPolicyInitStep(
  repository: ApiRepository,
  userId: string,
  now: Date,
): Promise<void> {
  const user = await requireUser(repository, userId);
  await initializeMailboxPolicyDefaults(repository, user.address, now);
}

async function activateAccount(repository: ApiRepository, user: User, now: Date): Promise<void> {
  if (user.status === "active") return;

  const blocked: readonly AccountStatus[] = ["suspended", "deactivated"];
  if (blocked.includes(user.status)) {
    throw new ApiError(
      409,
      "invalid_state_transition",
      `Account status "${user.status}" cannot be activated by provisioning`,
    );
  }

  const result = await repository.updateUser({ ...user, status: "active" }, user.version);
  if (!result.updated) {
    throw new ApiError(
      409,
      "conflict",
      "User record changed concurrently; activation must be retried",
    );
  }
}

// ---------------------------------------------------------------------------
// Public orchestrator API
// ---------------------------------------------------------------------------

/**
 * Returns the safe progress projection, or null when no provisioning record
 * exists for the user.
 */
export async function getProvisioningProgress(
  repository: ApiRepository,
  userId: string,
): Promise<ProvisioningProgress | null> {
  const record = await repository.getProvisioningRecord(userId);
  return record ? toProgress(record) : null;
}

/**
 * Idempotently provisions an account:
 * - no record      -> create one (pending) and run the flow
 * - pending/retryable -> resume from the completed steps (safe: every step
 *   is idempotent, so resumption never double-creates)
 * - active         -> return the current progress (idempotent replay)
 * - failed         -> conflict; the retry endpoint owns restarting it
 */
export async function provisionAccount(
  repository: ApiRepository,
  input: ProvisionAccountInput,
  now: Date = new Date(),
): Promise<ProvisioningProgress> {
  const normalizedUsername = usernameSchema.parse(input.username);
  const user = await repository.getUserByAddress(input.address);

  const createInitial = (userId: string, requestedUsername: string): ProvisioningRecord => ({
    userId,
    status: "pending",
    requestedUsername,
    displayName: input.displayName?.trim() || null,
    completedSteps: [],
    currentStep: PROVISIONING_STEPS[0],
    attempts: 0,
    failure: null,
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    version: 1,
  });

  if (!user) {
    // Deterministic input validation happens before any state is created: a
    // malformed request must surface as a 422, not as a failed provisioning
    // record that would need retry control to clear.
    if (!stellarAddressSchema.safeParse(input.address).success) {
      throw new ApiError(422, "validation_error", "A valid Stellar address is required");
    }
    if (!input.email) {
      throw new ApiError(422, "validation_error", "Email is required to bootstrap an account");
    }

    const userId = `u_${randomUUID()}`;
    const created = await repository.createProvisioningRecord(
      createInitial(userId, normalizedUsername),
    );
    const completed = await runFlow(repository, created.record, input, now);
    return toProgress(completed);
  }

  const existing = await repository.getProvisioningRecord(user.userId);
  if (!existing) {
    // The bound username is authoritative for an existing account; the
    // requested one can never re-bind it.
    const created = await repository.createProvisioningRecord(
      createInitial(user.userId, user.username),
    );
    const completed = await runFlow(repository, created.record, input, now);
    return toProgress(completed);
  }

  if (existing.status === "active") {
    return toProgress(existing);
  }
  if (existing.status === "failed") {
    throw new ApiError(
      409,
      "invalid_state_transition",
      "Account provisioning previously failed; use the retry endpoint",
    );
  }

  const resumed = await runFlow(repository, existing, input, now);
  return toProgress(resumed);
}

/**
 * Owner/administrator retry control. Only a retryable flow may be restarted;
 * active (terminal) and pending (already in flight) flows are rejected with
 * a deterministic 409, and a flow that exhausted its attempts stays failed.
 */
export async function retryAccountProvisioning(
  repository: ApiRepository,
  userId: string,
  now: Date = new Date(),
): Promise<ProvisioningProgress> {
  const record = await repository.getProvisioningRecord(userId);
  if (!record) {
    throw new ApiError(404, "not_found", "No provisioning record exists for this account");
  }
  if (record.status === "pending") {
    throw new ApiError(409, "invalid_state_transition", "Provisioning is already in flight");
  }
  if (record.status === "active") {
    throw new ApiError(409, "invalid_state_transition", "Account is already provisioned");
  }
  if (record.attempts + 1 > MAX_PROVISIONING_ATTEMPTS) {
    throw new ApiError(
      409,
      "invalid_state_transition",
      "Provisioning retry attempts are exhausted",
    );
  }

  const restarted: ProvisioningRecord = {
    ...record,
    status: "pending",
    failure: null,
    // The attempt counter increments on the next failed run (markFailure),
    // so restarting a run does not double-count it.
    attempts: record.attempts,
    currentStep: firstIncompleteStep(record),
  };
  const persisted = await persist(repository, restarted);
  const completed = await runFlow(
    repository,
    persisted,
    {
      address: "",
      username: persisted.requestedUsername,
    },
    now,
  );
  return toProgress(completed);
}
