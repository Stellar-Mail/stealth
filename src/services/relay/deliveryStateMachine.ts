import {
  ALLOWED_DELIVERY_TRANSITIONS,
  RETRYABLE_DELIVERY_STATES,
  TERMINAL_DELIVERY_STATES,
  type MessageDeliveryState,
  type MessageDeliveryStatusRecord,
  type MessageDeliveryTransition,
  type PublicDeliveryStatus,
} from "@/server/api/domain";

export class IllegalStateTransitionError extends Error {
  constructor(
    public readonly messageId: string,
    public readonly fromState: MessageDeliveryState | null,
    public readonly toState: MessageDeliveryState,
    public readonly reasonDetail: string,
  ) {
    super(
      `Illegal transition for message '${messageId}' from state '${
        fromState ?? "initial"
      }' to '${toState}': ${reasonDetail}`,
    );
    this.name = "IllegalStateTransitionError";
  }
}

export function isTerminalState(state: MessageDeliveryState): boolean {
  return TERMINAL_DELIVERY_STATES.has(state);
}

export function isRetryableState(state: MessageDeliveryState): boolean {
  return RETRYABLE_DELIVERY_STATES.has(state);
}

export function isValidTransition(
  fromState: MessageDeliveryState | null,
  toState: MessageDeliveryState,
): boolean {
  if (fromState === null) {
    return toState === "queued" || toState === "accepted";
  }
  if (fromState === toState) {
    return false; // Duplicate transitions strictly rejected
  }
  const allowed = ALLOWED_DELIVERY_TRANSITIONS[fromState];
  return allowed ? allowed.has(toState) : false;
}

export interface TransitionInput {
  messageId: string;
  toState: MessageDeliveryState;
  actor: string;
  reason: string;
  chainReference?: string | null;
  now?: Date;
}

export function applyTransition(
  currentRecord: MessageDeliveryStatusRecord | null,
  input: TransitionInput,
): MessageDeliveryStatusRecord {
  const { messageId, toState, actor, reason, chainReference, now = new Date() } = input;
  const fromState = currentRecord ? currentRecord.state : null;

  // 1. Terminal State Rule: cannot transition out of terminal state
  if (fromState !== null && isTerminalState(fromState)) {
    throw new IllegalStateTransitionError(
      messageId,
      fromState,
      toState,
      `Cannot transition out of terminal state '${fromState}'`,
    );
  }

  // 2. Duplicate Transition Rule
  if (fromState !== null && fromState === toState) {
    throw new IllegalStateTransitionError(
      messageId,
      fromState,
      toState,
      `Duplicate transition to the same state '${toState}' is rejected`,
    );
  }

  // 3. Valid Transition Matrix Rule
  if (!isValidTransition(fromState, toState)) {
    throw new IllegalStateTransitionError(
      messageId,
      fromState,
      toState,
      `Transition from '${fromState ?? "initial"}' to '${toState}' is illegal`,
    );
  }

  const timestampIso = now.toISOString();

  const transitionEntry: MessageDeliveryTransition = {
    fromState,
    toState,
    timestamp: timestampIso,
    actor,
    reason,
    chainReference: chainReference ?? null,
  };

  const history = currentRecord ? [...currentRecord.history, transitionEntry] : [transitionEntry];
  const isTerminal = isTerminalState(toState);
  const isRetryable = isRetryableState(toState);

  return {
    messageId,
    state: toState,
    isTerminal,
    isRetryable,
    createdAt: currentRecord ? currentRecord.createdAt : timestampIso,
    updatedAt: timestampIso,
    actor,
    reason,
    chainReference: chainReference ?? currentRecord?.chainReference ?? null,
    history,
  };
}

export function toPublicDeliveryStatus(record: MessageDeliveryStatusRecord): PublicDeliveryStatus {
  return {
    messageId: record.messageId,
    state: record.state,
    isTerminal: record.isTerminal,
    isRetryable: record.isRetryable,
    observedAt: record.updatedAt,
    actor: record.actor,
    reason: record.reason,
    chainReference: record.chainReference,
    history: record.history,
  };
}
