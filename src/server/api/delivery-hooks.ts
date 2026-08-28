import type { MessageDeliveryState, PublicDeliveryStatus } from "./domain";
import { ALLOWED_DELIVERY_TRANSITIONS } from "./domain";
import { getDeliveryState, transitionDeliveryState } from "./delivery-service";
import type { ApiRepository } from "./repository";
import { isTerminalState } from "@/services/relay/deliveryStateMachine";

const INITIAL_TARGETS = new Set<MessageDeliveryState>(["queued", "accepted"]);

function allowedTargets(fromState: MessageDeliveryState | null): MessageDeliveryState[] {
  if (fromState === null) {
    return [...INITIAL_TARGETS];
  }
  return [...(ALLOWED_DELIVERY_TRANSITIONS[fromState] ?? [])];
}

/** Shortest legal path from `fromState` to `targetState` (BFS over the transition graph). */
export function computeAdvanceSteps(
  fromState: MessageDeliveryState | null,
  targetState: MessageDeliveryState,
): MessageDeliveryState[] {
  if (fromState === targetState) {
    return [];
  }

  type QueueItem = { state: MessageDeliveryState | null; path: MessageDeliveryState[] };
  const queue: QueueItem[] = [{ state: fromState, path: [] }];
  const visited = new Set<string>([fromState ?? "null"]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of allowedTargets(current.state)) {
      const nextPath = [...current.path, next];
      if (next === targetState) {
        return nextPath;
      }
      const key = next;
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push({ state: next, path: nextPath });
    }
  }

  return [];
}

/**
 * Idempotently advances a message toward `targetState` along the shortest legal
 * path. No-op when already at the target or when the current state is terminal.
 */
export async function advanceToDeliveryState(
  repository: ApiRepository,
  messageId: string,
  targetState: MessageDeliveryState,
  actor: string,
  reason: string,
  chainReference?: string | null,
  now = new Date(),
): Promise<PublicDeliveryStatus | null> {
  const current = await repository.getMessageDeliveryStatus(messageId);
  const currentState = current?.state ?? null;

  if (currentState === targetState) {
    return current ? await getDeliveryState(repository, messageId) : null;
  }

  if (currentState !== null && isTerminalState(currentState)) {
    return await getDeliveryState(repository, messageId);
  }

  const steps = computeAdvanceSteps(currentState, targetState);
  if (steps.length === 0) {
    return current ? await getDeliveryState(repository, messageId) : null;
  }

  let last: PublicDeliveryStatus | null = null;
  for (const step of steps) {
    const chainRef = step === "anchored" ? chainReference : undefined;
    last = await transitionDeliveryState(repository, messageId, step, actor, reason, chainRef, now);
  }
  return last;
}

/** Records a single transition, propagating illegal-transition errors to callers. */
export async function recordDeliveryTransition(
  repository: ApiRepository,
  messageId: string,
  toState: MessageDeliveryState,
  actor: string,
  reason: string,
  chainReference?: string | null,
  now = new Date(),
): Promise<PublicDeliveryStatus> {
  return transitionDeliveryState(
    repository,
    messageId,
    toState,
    actor,
    reason,
    chainReference,
    now,
  );
}
