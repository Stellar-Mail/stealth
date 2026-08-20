/**
 * Relay receiving service (Issue #1935 BETA-028).
 *
 * This is the domain service behind the relay health contract and message
 * submission endpoint. It is transport-agnostic: the same instance backs the
 * Cloudflare worker routes and the local Docker entry, while concrete
 * {@link RelayPersistence} and {@link RelayWorker} implementations supply the
 * storage and delivery boundaries.
 *
 * Readiness rules (acceptance contract):
 * - storage  : persistence.ping() must resolve
 * - queue    : persistence.getQueueDepth() must resolve
 * - network  : required network configuration must be present and valid
 *
 * Health and readiness responses are deliberately free of secrets, URLs, and
 * user data so they can be served by unauthenticated load balancers.
 */
import { z } from "zod";

import { hash32Schema, stellarAddressSchema } from "@/server/api/domain";
import { InMemoryNonceStore, NonceService } from "@/server/api/auth/nonce-service";
import type { RelayPersistence } from "./persistence";
import type { RelayWorker } from "./worker";

export const RELAY_SERVICE_NAME = "stealth-relay";

export const DEFAULT_RELAY_READINESS_TIMEOUT_MS = 1_000;
export const DEFAULT_RELAY_TTL_MS = 60 * 60 * 1000;
export const MAX_RELAY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Encrypted relay message payload cap (base64 ciphertext). */
export const RELAY_MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

const hostnamePattern =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export const relaySubmissionSchema = z.object({
  messageId: hash32Schema,
  sender: stellarAddressSchema,
  recipient: stellarAddressSchema,
  recipientDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(hostnamePattern, "Expected a valid hostname"),
  payload: z
    .string()
    .min(1, "Payload must not be empty")
    .max(RELAY_MAX_PAYLOAD_BYTES, `Payload exceeds ${RELAY_MAX_PAYLOAD_BYTES} bytes`),
  ttlMs: z.number().int().positive().max(MAX_RELAY_TTL_MS).optional(),
});

export type RelaySubmissionInput = z.infer<typeof relaySubmissionSchema>;

export interface RelayHealth {
  status: "ok";
  service: string;
  version: string;
  time: string;
}

export type RelayDependencyName = "storage" | "queue" | "network";
export type RelayDependencyStatus = "ok" | "unavailable" | "timeout";

export interface RelayReadiness {
  ready: boolean;
  dependencies: Record<RelayDependencyName, RelayDependencyStatus>;
  timeoutMs: number;
}

export interface RelayVersion {
  app: string;
  apiVersion: string;
  protocolVersion: string;
  build: string;
}

export interface RelayNetworkConfig {
  horizonUrl: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
}

export interface RelayAcceptedEnvelope {
  messageId: string;
  sender: string;
  recipient: string;
  receivedAt: string;
}

export interface RelayServiceConfig {
  serviceName: string;
  version: string;
  apiVersion: string;
  protocolVersion: string;
  timeoutMs: number;
  network: RelayNetworkConfig;
  audience?: string;
  nonceService?: NonceService;
  nowSeconds?: () => number;
  /**
   * Best-effort hook invoked after a message is enqueued (e.g. scheduling the
   * lifecycle anchor for the commitment). Failures are swallowed: the durable
   * anchor record owns retries and reconciliation.
   */
  onAccepted?: (envelope: RelayAcceptedEnvelope) => void | Promise<void>;
  onIngestedReceipt?: (input: {
    messageId: string;
    sender: string;
    recipient: string;
    payload: string;
  }) => Promise<unknown>;
}

export interface RelaySubmitResult {
  accepted: boolean;
  messageId: string;
  queueDepth: number;
}

export interface ReadinessOptions {
  timeoutMs?: number;
  checkNetwork?: () => boolean | Promise<boolean>;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export class RelayService {
  private readonly nonceService: NonceService;
  private readonly audience: string;
  private readonly idempotencyStore = new Map<string, unknown>();
  private readonly seenNonces = new Set<string>();

  constructor(
    private readonly persistence: RelayPersistence,
    private readonly worker: RelayWorker,
    private readonly config: RelayServiceConfig,
  ) {
    this.nonceService = config.nonceService ?? new NonceService(new InMemoryNonceStore());
    this.audience = config.audience ?? "relay:stealth.test";
  }

  getNonceService(): NonceService {
    return this.nonceService;
  }

  getAudience(): string {
    return this.audience;
  }

  getConfig(): RelayServiceConfig {
    return this.config;
  }

  isNonceSeen(nonce: string): boolean {
    return this.seenNonces.has(nonce);
  }

  markNonceSeen(nonce: string): void {
    this.seenNonces.add(nonce);
  }

  getIdempotencyResult(key: string): unknown | null {
    return this.idempotencyStore.get(key) ?? null;
  }

  storeIdempotencyResult(key: string, result: unknown): void {
    this.idempotencyStore.set(key, result);
  }

  /**
   * Liveness probe. Always reports ok with no secrets so infrastructure can
   * rely on it without special handling.
   */
  async checkHealth(): Promise<RelayHealth> {
    return {
      status: "ok",
      service: this.config.serviceName,
      version: this.config.version,
      time: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe. Each dependency is checked concurrently with a bounded
   * timeout; the relay is ready only when storage, queue, and network are all
   * healthy.
   */
  async checkReadiness(options: ReadinessOptions = {}): Promise<RelayReadiness> {
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const checkNetwork = options.checkNetwork ?? this.defaultNetworkCheck.bind(this);

    const [storage, queue, network] = await Promise.all([
      this.probe("storage", () => this.persistence.ping(), timeoutMs),
      this.probe("queue", () => this.persistence.getQueueDepth(), timeoutMs),
      this.probe(
        "network",
        async () => {
          if (!(await checkNetwork())) {
            throw new Error("Required network configuration is unavailable");
          }
        },
        timeoutMs,
      ),
    ]);

    return {
      ready: storage === "ok" && queue === "ok" && network === "ok",
      dependencies: { storage, queue, network },
      timeoutMs,
    };
  }

  /** Immutable build/protocol descriptor for the relay. */
  getVersion(): RelayVersion {
    return {
      app: RELAY_SERVICE_NAME,
      apiVersion: this.config.apiVersion,
      protocolVersion: this.config.protocolVersion,
      build: this.config.version,
    };
  }

  /**
   * Accept a relay message into the queue. Input is re-validated at the domain
   * boundary (never trusted from the caller) and a {@link ZodError} is thrown
   * for invalid payloads.
   */
  async submit(input: RelaySubmissionInput): Promise<RelaySubmitResult> {
    const parsed = relaySubmissionSchema.safeParse(input);
    if (!parsed.success) {
      throw parsed.error;
    }

    const envelope = {
      messageId: parsed.data.messageId,
      sender: parsed.data.sender,
      recipient: parsed.data.recipient,
      recipientDomain: parsed.data.recipientDomain,
      payload: parsed.data.payload,
      ttlMs: parsed.data.ttlMs ?? DEFAULT_RELAY_TTL_MS,
      receivedAt: new Date().toISOString(),
    };

    await this.persistence.enqueue(envelope);
    if (this.config.onAccepted) {
      try {
        await this.config.onAccepted({
          messageId: envelope.messageId,
          sender: envelope.sender,
          recipient: envelope.recipient,
          receivedAt: envelope.receivedAt,
        });
      } catch {
        // Best-effort; the durable anchor record owns the outcome.
      }
    }
    if (this.config.onIngestedReceipt) {
      try {
        await this.config.onIngestedReceipt({
          messageId: envelope.messageId,
          sender: envelope.sender,
          recipient: envelope.recipient,
          payload: envelope.payload,
        });
      } catch {
        // Log / fail-soft: receipt publication error does not fail queue enqueue
      }
    }
    return {
      accepted: true,
      messageId: envelope.messageId,
      queueDepth: await this.persistence.getQueueDepth(),
    };
  }

  /**
   * Retrieve queued messages for a specific recipient address.
   */
  async getRecipientQueue(recipient: string) {
    const parsed = stellarAddressSchema.safeParse(recipient);
    if (!parsed.success) {
      throw new Error("Expected a valid Stellar G-address for recipient queue query");
    }
    return this.persistence.listRecipientQueue(parsed.data);
  }

  private defaultNetworkCheck(): boolean {
    const { horizonUrl, sorobanRpcUrl, networkPassphrase } = this.config.network;
    return Boolean(
      networkPassphrase &&
      networkPassphrase.length > 0 &&
      isValidHttpUrl(horizonUrl) &&
      isValidHttpUrl(sorobanRpcUrl),
    );
  }

  private async probe(
    _name: RelayDependencyName,
    operation: () => Promise<unknown>,
    timeoutMs: number,
  ): Promise<RelayDependencyStatus> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation().then(() => "ok" as const),
        new Promise<RelayDependencyStatus>((resolve) => {
          timer = setTimeout(() => resolve("timeout"), timeoutMs);
        }),
      ]);
    } catch {
      return "unavailable";
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
