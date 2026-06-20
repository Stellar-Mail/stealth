import type { Receipt } from "./domain";
import { ApiError } from "./errors";
import type { ApiRepository } from "./repository";

export async function createDeliveryReceipt(
  repository: ApiRepository,
  input: Pick<Receipt, "messageId" | "recipient" | "sender">,
  now = new Date(),
) {
  if (await repository.getReceipt(input.messageId)) {
    throw new ApiError(409, "conflict", "A delivery receipt already exists for this message");
  }

  return repository.setReceipt({
    ...input,
    deliveredAt: now.toISOString(),
    readAt: null,
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
  return markReceiptReadFrom(repository, receipt, now);
}

export async function markReceiptReadFrom(
  repository: ApiRepository,
  receipt: Receipt,
  now = new Date(),
) {
  if (receipt.readAt) {
    throw new ApiError(409, "conflict", "The receipt has already been marked as read", {
      readAt: receipt.readAt,
    });
  }

  return repository.setReceipt({
    ...receipt,
    readAt: now.toISOString(),
  });
}
