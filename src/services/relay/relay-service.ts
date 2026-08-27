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

import {
  hash32Schema,
  stellarAddressSchema,
  stroopAmountSchema,
  type StoredEnvelope,
} from "@/server/api/domain";
import { ApiError } from "@/server/api/errors";
import type { InsertEnvelopeResult } from "@/server/api/repository";
import { InMemoryNonceStore, NonceService } from "@/server/api/auth/nonce-service";
import type { RelayPersistence } from "./persistence";
import type { RelayWorker } from "./worker";
import type { RelayObjectStore } from "./object-store";
import {
  toSafeAdmissionDecision,
  type RelayAdmissionEvaluator,
  type RelayAdmissionEvidence,
  type SafeAdmissionDecision,
} from "./policy-admission";

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
  postage: stroopAmountSchema.optional().default("0"),
  verified: z.boolean().optional().default(false),
  receipt: z.boolean().optional().default(false),
});

export type RelaySubmissionInput = z.input<typeof relaySubmissionSchema>;

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
  /** Deployed Policies contract id used for live chain evaluation. */
  policiesContractId?: string;
}

export interface RelaySubmitResult {
  accepted: true;
  messageId: string;
  queueDepth: number;
  replayed: boolean;
  admission: SafeAdmissionDecision;
}

export interface RelayMailboxStore {
  insertEnvelope(envelope: StoredEnvelope): Promise<InsertEnvelopeResult>;
}

export interface RelayServiceDependencies {
  evaluator: RelayAdmissionEvaluator;
  objectStore?: RelayObjectStore;
  mailbox?: RelayMailboxStore;
  repository?: any;
  now?: () => Date;
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
  private readonly deps: RelayServiceDependencies;

  constructor(
    private readonly persistence: RelayPersistence,
    private readonly worker: RelayWorker,
    private readonly config: RelayServiceConfig,
    deps: RelayServiceDependencies = {
      evaluator: {
        async evaluate() {
          return {
            policyVersion: 0,
            allowed: true,
            kind: "request",
            reason: "policy_satisfied",
            rule: "default",
            requiredPostage: "0",
            source: "offchain_fallback",
            evaluatedAt: new Date().toISOString(),
          };
        },
      },
    },
  ) {
    this.deps = deps;
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

  getRepository(): any {
    return this.deps.repository ?? (this.deps.mailbox as any);
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
   * Accept a relay message into the queue only after the recipient's current
   * policy admits the sender. Blocked decisions never reach payload storage.
   * A retry of the same messageId returns the original recorded admission and
   * does not re-evaluate live policy (so a later policy change cannot rewrite
   * history).
   */
  async submit(input: RelaySubmissionInput): Promise<RelaySubmitResult> {
    const parsed = relaySubmissionSchema.safeParse(input);
    if (!parsed.success) {
      throw parsed.error;
    }

    const existing = await this.persistence.get(parsed.data.messageId);
    if (existing) {
      return {
        accepted: true,
        messageId: existing.messageId,
        queueDepth: await this.persistence.getQueueDepth(),
        replayed: true,
        admission: toSafeAdmissionDecision(existing.admission),
      };
    }

    const evidence = await this.deps.evaluator.evaluate({
      owner: parsed.data.recipient,
      sender: parsed.data.sender,
      postage: parsed.data.postage,
      verified: parsed.data.verified,
      receipt: parsed.data.receipt,
    });

    if (!evidence.allowed) {
      throwDeniedAdmission(evidence);
    }

    let payloadStorageKey: string | undefined;
    if (this.deps.objectStore) {
      payloadStorageKey = await this.deps.objectStore.storeEnvelopeBody({
        messageId: parsed.data.messageId,
        ownerAddress: parsed.data.recipient,
        contentType: "application/octet-stream",
        bytes: new TextEncoder().encode(parsed.data.payload),
      });
    }

    const receivedAt = (this.deps.now ?? (() => new Date()))().toISOString();
    const envelope = {
      messageId: parsed.data.messageId,
      sender: parsed.data.sender,
      recipient: parsed.data.recipient,
      recipientDomain: parsed.data.recipientDomain,
      payload: parsed.data.payload,
      ttlMs: parsed.data.ttlMs ?? DEFAULT_RELAY_TTL_MS,
      receivedAt,
      admission: evidence,
      ...(payloadStorageKey === undefined ? {} : { payloadStorageKey }),
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

    if (this.deps.mailbox) {
      await this.deps.mailbox.insertEnvelope({
        messageId: envelope.messageId,
        senderId: envelope.sender,
        recipientId: envelope.recipient,
        ciphertext: envelope.payload,
        protectedHeaders: {},
        createdAt: receivedAt,
        status: "pending",
        metadata: { admission: toSafeAdmissionDecision(evidence) },
      });
    }

    return {
      accepted: true,
      messageId: envelope.messageId,
      queueDepth: await this.persistence.getQueueDepth(),
      replayed: false,
      admission: toSafeAdmissionDecision(evidence),
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

/**
 * Maps a denied admission to a sender-actionable API error. The details object
 * is the safe decision (kind / reason / required postage / version) and never
 * includes the recipient's full policy, payload, or secrets.
 */
function throwDeniedAdmission(evidence: RelayAdmissionEvidence): never {
  const details = toSafeAdmissionDecision(evidence);
  if (evidence.kind === "priced") {
    throw new ApiError(
      422,
      "insufficient_postage",
      "The postage amount is below the required minimum",
      details,
    );
  }
  throw new ApiError(403, "forbidden", "The recipient policy does not admit this message", details);
}
