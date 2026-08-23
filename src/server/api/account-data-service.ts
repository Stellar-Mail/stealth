import type { AccountDeletionRequest } from "./domain";
import type { ApiRepository } from "./repository";
import { ApiError } from "./errors";

export const ACCOUNT_DELETION_COOLING_OFF_MS = 24 * 60 * 60 * 1000;

async function getOwnedUser(repository: ApiRepository, address: string) {
  const user = await repository.getUserByAddress(address);
  if (!user) throw new ApiError(404, "not_found", "Account not found");
  return user;
}

export async function exportAccountData(
  repository: ApiRepository,
  address: string,
  now = new Date(),
) {
  const user = await getOwnedUser(repository, address);
  return repository.exportAccount(user.userId, user.address, now);
}

export async function requestAccountDeletion(
  repository: ApiRepository,
  address: string,
  options: { now?: Date; coolingOffMs?: number } = {},
): Promise<AccountDeletionRequest> {
  const now = options.now ?? new Date();
  const user = await getOwnedUser(repository, address);
  const existing = await repository.getAccountDeletionRequest(user.userId);

  if (existing?.status === "completed") {
    throw new ApiError(409, "conflict", "Account deletion has already completed");
  }
  if (
    existing &&
    (existing.status === "cooling_off" || existing.status === "processing") &&
    new Date(existing.coolingOffEndsAt) > now
  ) {
    return existing;
  }

  const request: AccountDeletionRequest = {
    userId: user.userId,
    requestedAt: existing?.requestedAt ?? now.toISOString(),
    coolingOffEndsAt: new Date(
      now.getTime() + (options.coolingOffMs ?? ACCOUNT_DELETION_COOLING_OFF_MS),
    ).toISOString(),
    status: "cooling_off",
    attempt: existing?.attempt ?? 0,
    lastError: null,
    updatedAt: now.toISOString(),
  };
  await repository.deleteUserSessions(user.userId);
  return repository.setAccountDeletionRequest(request);
}

export async function cancelAccountDeletion(
  repository: ApiRepository,
  address: string,
  now = new Date(),
): Promise<AccountDeletionRequest> {
  const user = await getOwnedUser(repository, address);
  const existing = await repository.getAccountDeletionRequest(user.userId);
  if (!existing || existing.status !== "cooling_off") {
    throw new ApiError(409, "conflict", "Account deletion is not cancellable");
  }
  if (new Date(existing.coolingOffEndsAt) <= now) {
    throw new ApiError(409, "conflict", "Account deletion cooling-off period has ended");
  }
  return repository.setAccountDeletionRequest({
    ...existing,
    status: "cancelled",
    updatedAt: now.toISOString(),
  });
}

export async function processAccountDeletion(
  repository: ApiRepository,
  userId: string,
  options: { now?: Date } = {},
): Promise<AccountDeletionRequest> {
  const now = options.now ?? new Date();
  const existing = await repository.getAccountDeletionRequest(userId);
  if (!existing) throw new ApiError(404, "not_found", "Account deletion request not found");
  if (existing.status === "cancelled" || existing.status === "completed") return existing;
  if (new Date(existing.coolingOffEndsAt) > now) {
    throw new ApiError(409, "conflict", "Account deletion cooling-off period has not ended");
  }
  const processing = await repository.setAccountDeletionRequest({
    ...existing,
    status: "processing",
    attempt: existing.attempt + 1,
    updatedAt: now.toISOString(),
    lastError: null,
  });
  const user = await repository.getUserById(userId);
  if (!user) throw new ApiError(404, "not_found", "Account not found");

  try {
    await repository.deleteAccountData(userId, user.address, now);
    return repository.setAccountDeletionRequest({
      ...processing,
      status: "completed",
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Deletion failed";
    return repository.setAccountDeletionRequest({
      ...processing,
      status: "partial_failure",
      lastError: message,
      updatedAt: now.toISOString(),
    });
  }
}
