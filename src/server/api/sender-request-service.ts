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
  return result.request;
}
