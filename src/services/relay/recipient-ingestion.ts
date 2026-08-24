/**
 * Recipient Queue Ingestion Service (BETA-034).
 *
 * Drives inbound mail ingestion from the relay queue into the recipient's mailbox:
 * - Processes inbound envelopes through the hardened recipient pipeline (BETA-047)
 * - Quarantines invalid, corrupted, or unverified envelopes without leaking secrets
 * - Enforces exactly-once delivery and deduplication across concurrent workers
 * - Emits durable sync events to the mailbox repository
 */

import type { StoredEnvelope } from "@/server/api/domain";
import type { ApiRepository } from "@/server/api/repository";
import type { KeyProvider } from "@/services/crypto/open-envelope";
import { processInboundEnvelope } from "@/features/mail/recipient-pipeline";
import type { RelayEnvelope, RelayPersistence } from "./persistence";

export interface RecipientIngestionOptions {
  persistence: RelayPersistence;
  repository: Pick<ApiRepository, "insertEnvelope" | "getEnvelope" | "listRecipientEnvelopes">;
  keys?: KeyProvider;
  now?: () => Date;
  requireSenderSignature?: boolean;
}

export interface IngestionResult {
  messageId: string;
  recipient: string;
  status: "delivered" | "quarantined" | "duplicate" | "skipped";
  diagnosticId?: string;
}

export class RecipientIngestionService {
  private static readonly globalClaims = new Set<string>();
  private readonly persistence: RelayPersistence;
  private readonly repository: Pick<
    ApiRepository,
    "insertEnvelope" | "getEnvelope" | "listRecipientEnvelopes"
  >;
  private readonly keys?: KeyProvider;
  private readonly now: () => Date;
  private readonly requireSenderSignature: boolean;

  constructor(options: RecipientIngestionOptions) {
    this.persistence = options.persistence;
    this.repository = options.repository;
    this.keys = options.keys;
    this.now = options.now ?? (() => new Date());
    this.requireSenderSignature = options.requireSenderSignature ?? false;
  }

  /**
   * Atomically claims a messageId for ingestion to protect concurrent workers.
   */
  claim(messageId: string): boolean {
    if (RecipientIngestionService.globalClaims.has(messageId)) return false;
    RecipientIngestionService.globalClaims.add(messageId);
    return true;
  }

  /**
   * Release in-flight claim.
   */
  release(messageId: string): void {
    RecipientIngestionService.globalClaims.delete(messageId);
  }

  /**
   * Ingest a single relay envelope into the recipient mailbox exactly once.
   */
  async ingestEnvelope(envelope: RelayEnvelope): Promise<IngestionResult> {
    if (!this.claim(envelope.messageId)) {
      return {
        messageId: envelope.messageId,
        recipient: envelope.recipient,
        status: "skipped",
      };
    }

    try {
      // 1. Idempotency check: check if already exists in recipient repository
      const existing = await this.repository.getEnvelope(envelope.messageId);
      if (existing) {
        return {
          messageId: envelope.messageId,
          recipient: envelope.recipient,
          status: "duplicate",
        };
      }

      const receivedAt = envelope.receivedAt || this.now().toISOString();

      // 2. Validate envelope through cryptographic inbound pipeline if keys provided
      if (this.keys) {
        let payloadParsed: unknown = envelope.payload;
        try {
          payloadParsed = JSON.parse(envelope.payload);
        } catch {
          // If not JSON, pass as-is
        }

        const processResult = await processInboundEnvelope({
          input: {
            payload: payloadParsed,
            ciphertext: envelope.payload,
          },
          keys: this.keys,
          expectedRecipient: envelope.recipient,
          expectedSender: envelope.sender,
          requireSenderSignature: this.requireSenderSignature,
        });

        if (processResult.status === "quarantined") {
          // Quarantine invalid envelope: isolate without exposing raw content
          const storedQuarantine: StoredEnvelope = {
            messageId: envelope.messageId,
            senderId: envelope.sender,
            recipientId: envelope.recipient,
            ciphertext: "",
            protectedHeaders: {},
            createdAt: receivedAt,
            status: "quarantined",
            metadata: {
              quarantined: true,
              quarantineRecord: processResult.quarantineRecord,
            },
          };

          await this.repository.insertEnvelope(storedQuarantine);

          return {
            messageId: envelope.messageId,
            recipient: envelope.recipient,
            status: "quarantined",
            diagnosticId: processResult.quarantineRecord.diagnosticId,
          };
        }
      }

      // 3. Valid envelope: append to mailbox repository
      const storedEnvelope: StoredEnvelope = {
        messageId: envelope.messageId,
        senderId: envelope.sender,
        recipientId: envelope.recipient,
        ciphertext: envelope.payload,
        protectedHeaders: {},
        createdAt: receivedAt,
        status: "pending",
        metadata: {
          admission: envelope.admission,
          storageKey: envelope.payloadStorageKey,
        },
      };

      await this.repository.insertEnvelope(storedEnvelope);

      return {
        messageId: envelope.messageId,
        recipient: envelope.recipient,
        status: "delivered",
      };
    } finally {
      this.release(envelope.messageId);
    }
  }

  /**
   * Drain and ingest all queued envelopes for a specific recipient.
   */
  async ingestRecipientQueue(recipient: string): Promise<IngestionResult[]> {
    const queue = await this.persistence.listRecipientQueue(recipient);
    const results: IngestionResult[] = [];

    for (const envelope of queue) {
      const result = await this.ingestEnvelope(envelope);
      results.push(result);
    }

    return results;
  }
}
