/**
 * Relay Federation State Machine & Delivery Logic
 *
 * State Machine Documentation:
 *
 * 1. DISCOVERY: Resolve the target relay's URI and public key via Stellar/DNS federation.
 *    -> Transition to HANDOFF on success.
 *    -> Transition to DEAD_LETTER on permanent failure (e.g., domain not found).
 *    -> Transition to DISCOVERY (Retry) on transient failure.
 *
 * 2. HANDOFF: Authenticate and transmit the message to the peer relay.
 *    -> Transition to ACKNOWLEDGED on 2xx response.
 *    -> Transition to DEDUPLICATED if the peer indicates the message ID already exists.
 *    -> Transition to DEAD_LETTER on 4xx permanent failure (e.g., unauthorized, payload too large).
 *    -> Transition to HANDOFF (Retry) on 5xx or network errors, subject to backoff and expiry.
 *
 * 3. ACKNOWLEDGED: Delivery successful. Terminal state.
 *
 * 4. DEDUPLICATED: Cross-relay duplicate collapsed. Terminal state.
 *
 * 5. DEAD_LETTER: Permanent failure or expired retries. Emits actionable error code. Terminal state.
 */

export type DeliveryState =
  | "DISCOVERY"
  | "HANDOFF"
  | "ACKNOWLEDGED"
  | "DEDUPLICATED"
  | "DEAD_LETTER";

export interface FederationMessage {
  id: string;
  recipientDomain: string;
  payload: string;
  expiryTimestamp: number;
}

export interface RelayNode {
  domain: string;
  endpoint: string;
  publicKey: string;
}

export type ActionableErrorCode =
  | "ERR_DOMAIN_NOT_FOUND"
  | "ERR_UNAUTHORIZED"
  | "ERR_PAYLOAD_REJECTED"
  | "ERR_DELIVERY_EXPIRED"
  | "ERR_UNKNOWN_PERMANENT";

export interface DeliveryResult {
  state: DeliveryState;
  attempts: number;
  errorCode?: ActionableErrorCode;
}

export class FederationDeliveryService {
  private readonly MAX_RETRIES = 5;
  private readonly BASE_BACKOFF_MS = 1000;

  // In-memory duplicate tracking (in a real system, this is backed by Redis/DB)
  private seenMessageIds: Set<string> = new Set();
  // Simulated dead-letter queue
  public deadLetterQueue: Array<{ message: FederationMessage; code: ActionableErrorCode }> = [];

  constructor(
    private resolveRelay: (domain: string) => Promise<RelayNode | null>,
    private transmitMessage: (
      node: RelayNode,
      message: FederationMessage,
    ) => Promise<{ status: number }>,
  ) {}

  /**
   * Main delivery loop implementing the state machine and retries.
   */
  public async deliver(message: FederationMessage): Promise<DeliveryResult> {
    if (this.seenMessageIds.has(message.id)) {
      return { state: "DEDUPLICATED", attempts: 0 };
    }

    let state: DeliveryState = "DISCOVERY";
    let attempts = 0;
    let relayNode: RelayNode | null = null;

    while (state !== "ACKNOWLEDGED" && state !== "DEAD_LETTER" && state !== "DEDUPLICATED") {
      if (Date.now() > message.expiryTimestamp) {
        this.moveToDeadLetter(message, "ERR_DELIVERY_EXPIRED");
        return { state: "DEAD_LETTER", attempts, errorCode: "ERR_DELIVERY_EXPIRED" };
      }

      try {
        if (state === "DISCOVERY") {
          relayNode = await this.resolveRelay(message.recipientDomain);
          if (!relayNode) {
            this.moveToDeadLetter(message, "ERR_DOMAIN_NOT_FOUND");
            state = "DEAD_LETTER";
            break;
          }
          state = "HANDOFF";
        }

        if (state === "HANDOFF" && relayNode) {
          attempts++;
          const response = await this.transmitMessage(relayNode, message);

          if (response.status >= 200 && response.status < 300) {
            state = "ACKNOWLEDGED";
            this.seenMessageIds.add(message.id);
          } else if (response.status === 409) {
            // Conflict implies already exists -> deduplication
            state = "DEDUPLICATED";
            this.seenMessageIds.add(message.id);
          } else if (response.status >= 400 && response.status < 500) {
            const code =
              response.status === 401 || response.status === 403
                ? "ERR_UNAUTHORIZED"
                : "ERR_PAYLOAD_REJECTED";
            this.moveToDeadLetter(message, code);
            state = "DEAD_LETTER";
          } else {
            // Transient 5xx error, throw to trigger retry logic
            throw new Error(`Transient error: HTTP ${response.status}`);
          }
        }
      } catch (error) {
        if (attempts >= this.MAX_RETRIES) {
          this.moveToDeadLetter(message, "ERR_DELIVERY_EXPIRED");
          state = "DEAD_LETTER";
        } else {
          // Bounded and jittered backoff
          await this.delay(this.calculateBackoff(attempts));
        }
      }
    }

    const result: DeliveryResult = { state, attempts };
    if (state === "DEAD_LETTER") {
      const dlqEntry = this.deadLetterQueue.find((e) => e.message.id === message.id);
      result.errorCode = dlqEntry?.code || "ERR_UNKNOWN_PERMANENT";
    }
    return result;
  }

  private calculateBackoff(attempt: number): number {
    const exponential = this.BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 500; // up to 500ms of jitter
    return exponential + jitter;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private moveToDeadLetter(message: FederationMessage, code: ActionableErrorCode) {
    this.deadLetterQueue.push({ message, code });
  }

  public inspectDeadLetters() {
    return this.deadLetterQueue;
  }
}
