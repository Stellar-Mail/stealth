// ---------------------------------------------------------------------------
// BETA-069 (Issue #1976) — Account Settings Service
//
// Encapsulates business logic for profile reads and updates. Profile updates
// use optimistic concurrency (version field) and emit audit events. Sensitive
// updates require a recent-auth gate (session created within threshold).
// ---------------------------------------------------------------------------

import type { ApiRepository } from "./repository";
import type { User, Profile, ProfileUpdateInput, AccountInfo } from "./domain";
import { profileUpdateSchema, toPublicProfile, toPublicUser } from "./domain";
import type { PublicProfile, PublicUser } from "./domain";
import { ApiError } from "./errors";
import { recordAuditEvent } from "./audit";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum session age (in ms) for sensitive profile changes. If the session
 * was authenticated more than this threshold ago, the client must re-auth.
 */
const RECENT_AUTH_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

/** Static beta limitations exposed in the account info response. */
const BETA_LIMITATIONS: readonly string[] = [
  "Username changes are not currently supported",
  "Email changes require identity verification (not yet available)",
  "Testnet only — no real assets or mainnet connectivity",
  "Rate limits may be more restrictive than production",
  "Data may be reset during the beta period",
];

const DEFAULT_NETWORK = "Testnet";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountProfileResult {
  user: PublicUser;
  profile: PublicProfile;
  account: AccountInfo;
}

export interface ProfileUpdateResult {
  profile: PublicProfile;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Loads the authenticated user's profile composite: public user info,
 * editable profile fields, and immutable account identifiers.
 *
 * Time Complexity: O(1) for each repository call
 */
export async function getAccountProfile(
  repo: ApiRepository,
  actor: string,
  requestId: string,
): Promise<AccountProfileResult> {
  const user = await repo.getUserByAddress(actor);
  if (!user) {
    throw new ApiError(404, "not_found", "Account not found for the authenticated address");
  }

  const profile = await repo.getProfile(user.userId);
  if (!profile) {
    throw new ApiError(404, "not_found", "Profile not found for the authenticated user");
  }

  // Best-effort policy version lookup
  let policyVersion: number | null = null;
  try {
    const policy = await repo.getPolicy(actor);
    // The MailboxPolicy type doesn't have a version field; use null for now.
    // If a versioned policy write intent exists, extract the version from there.
    if (policy) {
      const intent = await repo.getPolicyWriteIntent(actor);
      policyVersion = null; // intent version removed
    }
  } catch {
    // Policy lookup failure should not block profile reads
    policyVersion = null;
  }

  recordAuditEvent({
    actor,
    action: "profile.read",
    targetType: "profile",
    safeTargetReference: `profile:${user.userId}`,
    result: "success",
    requestId,
  });

  return {
    user: toPublicUser(user),
    profile: toPublicProfile(profile),
    account: {
      userId: user.userId,
      username: user.username,
      address: user.address,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      network: DEFAULT_NETWORK,
      policyVersion,
      betaLimitations: [...BETA_LIMITATIONS],
    },
  };
}

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

/**
 * Validates and applies a partial profile update with optimistic concurrency.
 *
 * Security invariants:
 * - Username is never accepted in the update payload (immutable).
 * - The `version` field must match the current profile's version (derived
 *   from `updatedAt` timestamp hash) to prevent stale overwrites.
 * - A recent-auth gate prevents changes from stale sessions.
 * - Every update emits a structured audit event listing which fields changed
 *   (but never field values).
 */
export async function updateAccountProfile(
  repo: ApiRepository,
  actor: string,
  rawInput: unknown,
  requestId: string,
  sessionAuthenticatedAt?: Date,
): Promise<ProfileUpdateResult> {
  // Validate input
  const parseResult = profileUpdateSchema.safeParse(rawInput);
  if (!parseResult.success) {
    throw new ApiError(422, "validation_error", "Invalid profile update", {
      details: parseResult.error.flatten().fieldErrors,
    });
  }
  const input = parseResult.data;

  // Recent-auth gate for sensitive changes
  if (sessionAuthenticatedAt) {
    const ageMs = Date.now() - sessionAuthenticatedAt.getTime();
    if (ageMs > RECENT_AUTH_THRESHOLD_MS) {
      throw new ApiError(
        403,
        "recent_auth_required",
        "Please re-authenticate to update your profile. Your session is older than 15 minutes.",
      );
    }
  }

  // Load current user and profile
  const user = await repo.getUserByAddress(actor);
  if (!user) {
    throw new ApiError(404, "not_found", "Account not found for the authenticated address");
  }

  const currentProfile = await repo.getProfile(user.userId);
  if (!currentProfile) {
    throw new ApiError(404, "not_found", "Profile not found for the authenticated user");
  }

  // Optimistic concurrency check: version must match current updatedAt-derived version
  const currentVersion = profileVersion(currentProfile);
  if (input.version !== currentVersion) {
    throw new ApiError(
      409,
      "conflict",
      "Profile has been modified since you last loaded it. Please reload and try again.",
      {
        details: { currentVersion, suppliedVersion: input.version },
      },
    );
  }

  // Build the merged profile
  const now = new Date().toISOString();
  const updatedProfile: Profile = {
    ...currentProfile,
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
    ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    ...(input.avatarMetadata !== undefined ? { avatarMetadata: input.avatarMetadata } : {}),
    ...(input.locale !== undefined ? { locale: input.locale } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.addressDisplay !== undefined ? { addressDisplay: input.addressDisplay } : {}),
    ...(input.notifications !== undefined
      ? {
          notifications: {
            email: input.notifications.email ?? currentProfile.notifications?.email ?? true,
            desktop: input.notifications.desktop ?? currentProfile.notifications?.desktop ?? true,
            sound: input.notifications.sound ?? currentProfile.notifications?.sound ?? false,
          },
        }
      : {}),
    updatedAt: now,
  };

  // Persist
  const saved = await repo.setProfile(updatedProfile);

  // Audit — list changed field names, never values
  const changedFields = Object.keys(input).filter(
    (k) => k !== "version" && (input as Record<string, unknown>)[k] !== undefined,
  );

  recordAuditEvent({
    actor,
    action: "profile.update",
    targetType: "profile",
    safeTargetReference: `profile:${user.userId}:fields=${changedFields.join(",")}`,
    result: "success",
    requestId,
  });

  return {
    profile: toPublicProfile(saved),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives a deterministic integer version from a profile's `updatedAt`
 * timestamp. This is used for optimistic concurrency: the client must send
 * the version it last read, and the server rejects the update if it doesn't
 * match. Using a timestamp-based version avoids a separate version counter
 * column while remaining collision-resistant (millisecond precision).
 */
export function profileVersion(profile: Profile): number {
  return new Date(profile.updatedAt).getTime();
}
