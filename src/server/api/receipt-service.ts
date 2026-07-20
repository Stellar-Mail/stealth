import type { Receipt } from "./domain";
import { ApiError } from "./errors";
import type { ApiRepository } from "./repository";

const MAX_SKEW_MS = 5 * 60 * 1000; // 5 minutes

export async function createDeliveryReceipt(
  repository: ApiRepository,
  input: Pick<Receipt, "messageId" | "recipient" | "sender"> & { claimedAt?: string },
  now = new Date(),
) {
  if (await repository.getReceipt(input.messageId)) {
    throw new ApiError(409, "conflict", "A delivery receipt already exists for this message");
  }

  validateTimestampSkew(input.claimedAt, now, "claimedAt");

  return repository.setReceipt({
    ...input,
    deliveredAt: now.toISOString(),
    serverDeliveredAt: now.toISOString(),
    readAt: null,
    serverReadAt: null,
  });
}

export async function getReceipt(repository: ApiRepository, messageId: string) {
  const receipt = await repository.getReceipt(messageId);
  if (!receipt) {
    throw new ApiError(404, "not_found", "Receipt was not found");
  }
  return receipt;
}

export function assertReceiptParticipant(receipt: Receipt, actor: string) {
  if (actor !== receipt.sender && actor !== receipt.recipient) {
    throw new ApiError(403, "forbidden", "Only message participants can read this receipt");
  }
}

export async function markReceiptRead(
  repository: ApiRepository,
  messageId: string,
  now = new Date(),
) {
  const receipt = await getReceipt(repository, messageId);
  if (receipt.readAt) {
    throw new ApiError(409, "conflict", "The receipt has already been marked as read", {
      readAt: receipt.readAt,
    });
  }

  return repository.setReceipt({
    ...receipt,
    readAt: now.toISOString(),
    serverReadAt: now.toISOString(),
  });
}

function validateTimestampSkew(claimed: string | undefined, now: Date, field: string) {
  if (!claimed) return;
  const claimedDate = new Date(claimed);
  if (isNaN(claimedDate.getTime())) {
    throw new ApiError(422, "validation_error", ${field} is not a valid ISO timestamp);
  }
  const skew = Math.abs(now.getTime() - claimedDate.getTime());
  if (skew > MAX_SKEW_MS) {
    throw new ApiError(
      422,
      "validation_error",
      ${field} skew of s exceeds maximum of s,
    );
  }
}
