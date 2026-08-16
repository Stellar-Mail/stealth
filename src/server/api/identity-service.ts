import { toFederationAddress, toStealthAddress } from "@/features/identity/federation";
import { type CanonicalUsername, usernameSchema } from "@/features/identity/username";

import { recordAuditEvent } from "./audit";
import type { UsernameRecord } from "./domain";
import { ApiError } from "./errors";
import type { ApiRepository } from "./repository";

export interface UsernameAvailability {
  username: CanonicalUsername;
  available: boolean;
}

/**
 * Validates and canonicalizes `rawUsername`, then reports whether it is
 * currently reservable.
 *
 * Format, length, and reserved-word violations throw a 422 `validation_error`
 * *before* the repository is ever consulted — those rules are deterministic
 * functions of the input alone, so surfacing them as validation errors keeps
 * the boolean `available` result from conflating "malformed input" with "a
 * real reservation already exists", and never requires exposing who (if
 * anyone) holds the name.
 */
export async function checkUsernameAvailability(
  repository: ApiRepository,
  rawUsername: string,
): Promise<UsernameAvailability> {
  const username = usernameSchema.parse(rawUsername);
  const existing = await repository.getUsernameRecord(username);
  return { username, available: existing === null };
}

export interface ReserveUsernameInput {
  rawUsername: string;
  ownerAddress: string;
}

/**
 * Atomically reserves a username for `ownerAddress`.
 *
 * Concurrent callers racing on the same normalized username (including case
 * or confusable variants, which canonicalize to the same value) are
 * guaranteed exactly one winner by {@link ApiRepository.reserveUsernameIfAbsent}.
 * Every loser — including the original owner retrying without an idempotency
 * key — receives a deterministic `username_taken` (409) rather than silently
 * overwriting the existing reservation.
 */
export async function reserveUsername(
  repository: ApiRepository,
  input: ReserveUsernameInput,
  now: Date = new Date(),
  requestId = "unknown",
): Promise<UsernameRecord> {
  const username = usernameSchema.parse(input.rawUsername);

  const record: UsernameRecord = {
    username,
    ownerAddress: input.ownerAddress,
    stealthAddress: toStealthAddress(username),
    federationAddress: toFederationAddress(username),
    createdAt: now.toISOString(),
  };

  const result = await repository.reserveUsernameIfAbsent(record);

  if (result.outcome === "taken") {
    recordAuditEvent({
      actor: input.ownerAddress,
      action: "identity.username.reserve",
      targetType: "username",
      safeTargetReference: username,
      result: "denied",
      requestId,
    });
    throw new ApiError("username_taken", { username });
  }

  recordAuditEvent({
    actor: input.ownerAddress,
    action: "identity.username.reserve",
    targetType: "username",
    safeTargetReference: username,
    result: "success",
    requestId,
  });

  return result.record;
}
