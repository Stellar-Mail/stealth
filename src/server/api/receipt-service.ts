import type { Receipt } from "./domain";
import { ApiError } from "./errors";
import {
  computePayloadHash,
  RuntimeReceiptsContractProvider,
  type ContractReceiptInfo,
  type ReceiptsContractProvider,
} from "./receipt-contract-service";
import type { ApiRepository } from "./repository";
import { advanceToDeliveryState } from "./delivery-hooks";

function isSameReceiptParticipants(
  receipt: Pick<Receipt, "recipient" | "sender">,
  input: Pick<Receipt, "recipient" | "sender">,
) {
  return receipt.recipient === input.recipient && receipt.sender === input.sender;
}

export interface CreateDeliveryReceiptInput {
  messageId: string;
  recipient: string;
  sender: string;
  payloadHash?: string;
  payload?: string;
  protocolVersion?: number;
}

export async function createDeliveryReceipt(
  repository: ApiRepository,
  input: CreateDeliveryReceiptInput,
  now = new Date(),
  contractProvider?: ReceiptsContractProvider,
): Promise<Receipt> {
  const payloadHash = input.payloadHash ?? computePayloadHash(input.messageId, input.payload);
  const protocolVersion = input.protocolVersion ?? 1;

  let contractInfo: Partial<ContractReceiptInfo> = {};
  if (contractProvider || process.env.STEALTH_RECEIPTS_LIVE === "true") {
    const provider = contractProvider ?? new RuntimeReceiptsContractProvider();
    contractInfo = await provider.publishDeliveredReceipt({
      messageId: input.messageId,
      sender: input.sender,
      recipient: input.recipient,
      payloadHash,
      protocolVersion,
      deliveredAt: now.toISOString(),
    });
  }

  const { receipt } = await repository.createReceiptIfAbsent({
    messageId: input.messageId,
    recipient: input.recipient,
    sender: input.sender,
    deliveredAt: contractInfo.deliveredAt || now.toISOString(),
    readAt: contractInfo.readAt ?? null,
    ...(contractInfo.payloadHash ? { payloadHash: contractInfo.payloadHash } : {}),
    ...(contractInfo.protocolVersion ? { protocolVersion: contractInfo.protocolVersion } : {}),
    ...(contractInfo.txHash !== undefined ? { txHash: contractInfo.txHash } : {}),
    ...(contractInfo.confirmed !== undefined
      ? { chainStatus: contractInfo.confirmed ? "confirmed" : "pending" }
      : {}),
  });

  if (!isSameReceiptParticipants(receipt, input)) {
    throw new ApiError(
      409,
      "conflict",
      "A delivery receipt already exists for this message with different participants",
    );
  }

  await advanceToDeliveryState(
    repository,
    input.messageId,
    "delivered",
    input.recipient,
    "Delivered to recipient mailbox",
    null,
    now,
  );

  return receipt;
}

export async function getReceipt(
  repository: ApiRepository,
  messageId: string,
  contractProvider?: ReceiptsContractProvider,
): Promise<Receipt> {
  const receipt = await repository.getReceipt(messageId);
  if (receipt) {
    return receipt;
  }

  if (contractProvider || process.env.STEALTH_RECEIPTS_LIVE === "true") {
    const provider = contractProvider ?? new RuntimeReceiptsContractProvider();
    const onChain = await provider.getOnChainReceipt(messageId);
    if (onChain) {
      const { receipt: created } = await repository.createReceiptIfAbsent({
        messageId: onChain.messageId,
        recipient: onChain.recipient,
        sender: onChain.sender,
        deliveredAt: onChain.deliveredAt,
        readAt: onChain.readAt,
        payloadHash: onChain.payloadHash,
        protocolVersion: onChain.protocolVersion,
        txHash: onChain.txHash ?? null,
        chainStatus: onChain.confirmed ? "confirmed" : "pending",
      });
      return created;
    }
  }

  throw new ApiError(404, "not_found", "Receipt was not found");
}

export function assertReceiptParticipant(receipt: Receipt, actor: string) {
  if (actor !== receipt.sender && actor !== receipt.recipient) {
    throw new ApiError(403, "forbidden", "Only message participants can read this receipt");
  }
}

export async function markReceiptRead(
  repository: ApiRepository,
  messageId: string,
  actor: string,
  now = new Date(),
  contractProvider?: ReceiptsContractProvider,
): Promise<Receipt> {
  if (contractProvider || process.env.STEALTH_RECEIPTS_LIVE === "true") {
    const provider = contractProvider ?? new RuntimeReceiptsContractProvider();
    const existing = await getReceipt(repository, messageId, provider);
    assertReceiptParticipant(existing, actor);
    if (actor !== existing.recipient) {
      throw new ApiError(403, "forbidden", "Only the message recipient can publish read receipts");
    }
    const contractInfo = await provider.publishReadReceipt({
      messageId,
      actor,
      readAt: now.toISOString(),
    });
    if (contractInfo.readAt) {
      now = new Date(contractInfo.readAt);
    }
  }

  const result = await repository.markReceiptRead(messageId, actor, now);

  if (result.outcome === "not-found") {
    throw new ApiError(404, "not_found", "Receipt was not found");
  }
  if (result.outcome === "forbidden") {
    throw new ApiError(403, "forbidden", "Only message participants can read this receipt");
  }
  if (result.outcome === "already-read") {
    const receipt = await repository.getReceipt(messageId);
    if (!receipt) {
      throw new ApiError(404, "not_found", "Receipt was not found");
    }
    return receipt;
  }

  await advanceToDeliveryState(
    repository,
    messageId,
    "read",
    result.receipt.recipient,
    "Marked as read by recipient",
    null,
    now,
  );

  return result.receipt;
}
