import { ApiError } from "./errors";
import type { UnknownSenderDecision, UnknownSenderRequest } from "./domain";
import type { ApiRepository } from "./repository";

export async function createSenderRequest(
  repository: ApiRepository,
  request: UnknownSenderRequest,
): Promise<{ created: boolean; request: UnknownSenderRequest }> {
  return repository.createSenderRequestIfAbsent(request);
}

/**
 * Makes exactly one durable terminal decision. Approved requests represent a
 * released inbox message; always_allow/block additionally change the sender
 * rule in the same repository decision path.
 */
export async function decideSenderRequest(
  repository: ApiRepository,
  requestId: string,
  recipient: string,
  decision: UnknownSenderDecision,
): Promise<UnknownSenderRequest> {
  const result = await repository.transitionSenderRequest(requestId, recipient, decision);
  if (result.outcome === "not_found") {
    throw new ApiError(404, "not_found", "Sender request was not found");
  }
  if (result.outcome === "conflict") {
    throw new ApiError(409, "conflict", "Sender request has already been decided or expired", {
      status: result.request.status,
      decision: result.request.decision,
    });
  }

  const request = result.request;
  // Apply policy mutations if always_allow or block
  if (decision === "always_allow") {
    await repository.setSenderRule(recipient, request.sender, "allow");
  } else if (decision === "block") {
    await repository.setSenderRule(recipient, request.sender, "block");
  }

  // Reflect resulting mailbox/envelope delivery or deletion
  const messageId = request.message.messageId;
  const envelope = await repository.getEnvelope(messageId);
  if (envelope) {
    if (decision === "approve_once" || decision === "always_allow") {
      await repository.updateEnvelopeStatus(messageId, "delivered");
    } else if (decision === "block" || decision === "reject") {
      await repository.tombstoneEnvelope(messageId, recipient);
    }
  }

  return request;
}
