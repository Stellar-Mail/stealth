import type { MessageDeliveryState, PublicDeliveryStatus } from "./domain";
import { ApiError } from "./errors";
import type { ApiRepository } from "./repository";
import {
  applyTransition,
  IllegalStateTransitionError,
  toPublicDeliveryStatus,
} from "@/services/relay/deliveryStateMachine";

export async function transitionDeliveryState(
  repository: ApiRepository,
  messageId: string,
  toState: MessageDeliveryState,
  actor: string,
  reason: string,
  chainReference?: string | null,
  now = new Date(),
): Promise<PublicDeliveryStatus> {
  const current = await repository.getMessageDeliveryStatus(messageId);

  try {
    const updated = applyTransition(current, {
      messageId,
      toState,
      actor,
      reason,
      chainReference,
      now,
    });
    await repository.setMessageDeliveryStatus(updated);
    return toPublicDeliveryStatus(updated);
  } catch (error) {
    if (error instanceof IllegalStateTransitionError) {
      throw new ApiError(409, "conflict", error.message, {
        fromState: error.fromState,
        toState: error.toState,
      });
    }
    throw error;
  }
}

export async function getDeliveryState(
  repository: ApiRepository,
  messageId: string,
): Promise<PublicDeliveryStatus> {
  const record = await repository.getMessageDeliveryStatus(messageId);
  if (!record) {
    throw new ApiError(404, "not_found", `Delivery status for message '${messageId}' not found`);
  }
  return toPublicDeliveryStatus(record);
}
