import type { Receipt } from "@/server/api/domain";
import { ApiError } from "@/server/api/errors";

type ReceiptParticipants = Pick<Receipt, "recipient" | "sender">;

export function assertCanPublishDeliveryReceipt(
  principal: string,
  participants: ReceiptParticipants,
) {
  if (principal !== participants.sender) {
    throw new ApiError(403, "forbidden", "Only the message sender can publish delivery receipts");
  }
}

export function assertCanPublishReadReceipt(principal: string, participants: ReceiptParticipants) {
  if (principal !== participants.recipient) {
    throw new ApiError(403, "forbidden", "Only the message recipient can publish read receipts");
  }
}
