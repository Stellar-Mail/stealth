import { createHash } from "node:crypto";
import { loadRuntimeConfig, type BetaRuntimeConfig } from "../../config";
import {
  createReceiptsClient,
  delivered as contractDelivered,
  get as contractGet,
  read as contractRead,
  ReceiptsError,
} from "@/services/stellar/contracts/receipts";
import type { Receipt } from "./domain";
import { ApiError } from "./errors";

export interface PublishDeliveredInput {
  messageId: string;
  sender: string;
  recipient: string;
  payloadHash?: string;
  protocolVersion?: number;
  deliveredAt?: string;
}

export interface PublishReadInput {
  messageId: string;
  actor: string;
  readAt?: string;
}

export interface ContractReceiptInfo {
  messageId: string;
  sender: string;
  recipient: string;
  payloadHash: string;
  protocolVersion: number;
  deliveredAt: string;
  readAt: string | null;
  confirmed: boolean;
  txHash?: string | null;
  source: "contract" | "static";
}

export interface ReceiptsContractProvider {
  publishDeliveredReceipt(input: PublishDeliveredInput): Promise<ContractReceiptInfo>;
  publishReadReceipt(input: PublishReadInput): Promise<ContractReceiptInfo>;
  getOnChainReceipt(messageId: string): Promise<ContractReceiptInfo | null>;
}

export function computePayloadHash(messageId: string, payload?: string): string {
  if (payload && payload.length > 0) {
    return createHash("sha256").update(payload).digest("hex");
  }
  return createHash("sha256").update(`message-payload:${messageId}`).digest("hex");
}

function hexToBuffer(hex: string): Buffer {
  const clean = hex.replace(/^0x/i, "").padStart(64, "0");
  return Buffer.from(clean, "hex");
}

function bufferToHex(buf: Buffer): string {
  return buf.toString("hex").padStart(64, "0");
}

function safeLoadConfig(): BetaRuntimeConfig {
  try {
    return loadRuntimeConfig();
  } catch {
    return loadRuntimeConfig({ profile: "development", env: {} });
  }
}

/**
 * Static in-memory receipts contract provider for isolated testing & development.
 */
export class StaticReceiptsContractProvider implements ReceiptsContractProvider {
  private readonly store = new Map<string, ContractReceiptInfo>();

  async publishDeliveredReceipt(input: PublishDeliveredInput): Promise<ContractReceiptInfo> {
    const existing = this.store.get(input.messageId);
    const payloadHash = input.payloadHash ?? computePayloadHash(input.messageId);
    const protocolVersion = input.protocolVersion ?? 1;
    const nowIso = input.deliveredAt ?? new Date().toISOString();

    if (existing) {
      if (
        existing.sender !== input.sender ||
        existing.recipient !== input.recipient ||
        existing.payloadHash !== payloadHash ||
        existing.protocolVersion !== protocolVersion
      ) {
        throw new ApiError(
          409,
          "conflict",
          "A delivery receipt already exists for this message with different parameters",
        );
      }
      return existing;
    }

    const receipt: ContractReceiptInfo = {
      messageId: input.messageId,
      sender: input.sender,
      recipient: input.recipient,
      payloadHash,
      protocolVersion,
      deliveredAt: nowIso,
      readAt: null,
      confirmed: true,
      txHash: `0x${computePayloadHash(input.messageId, "tx-delivered")}`,
      source: "static",
    };

    this.store.set(input.messageId, receipt);
    return receipt;
  }

  async publishReadReceipt(input: PublishReadInput): Promise<ContractReceiptInfo> {
    const existing = this.store.get(input.messageId);
    if (!existing) {
      throw new ApiError(404, "not_found", "Receipt was not found");
    }

    if (input.actor !== existing.recipient) {
      throw new ApiError(403, "forbidden", "Only the message recipient can publish read receipts");
    }

    if (existing.readAt) {
      return existing;
    }

    const updated: ContractReceiptInfo = {
      ...existing,
      readAt: input.readAt ?? new Date().toISOString(),
      txHash: `0x${computePayloadHash(input.messageId, "tx-read")}`,
    };

    this.store.set(input.messageId, updated);
    return updated;
  }

  async getOnChainReceipt(messageId: string): Promise<ContractReceiptInfo | null> {
    return this.store.get(messageId) ?? null;
  }
}

/**
 * Runtime Soroban testnet receipts contract provider.
 */
export class RuntimeReceiptsContractProvider implements ReceiptsContractProvider {
  private readonly config: BetaRuntimeConfig;
  private readonly live: boolean;
  private readonly fallback: StaticReceiptsContractProvider;

  constructor(config: BetaRuntimeConfig = safeLoadConfig()) {
    this.config = config;
    this.live = process.env.STEALTH_RECEIPTS_LIVE === "true";
    this.fallback = new StaticReceiptsContractProvider();
  }

  async publishDeliveredReceipt(input: PublishDeliveredInput): Promise<ContractReceiptInfo> {
    if (!this.live) {
      return this.fallback.publishDeliveredReceipt(input);
    }

    try {
      const client = createReceiptsClient({
        contractId: this.config.contract.receiptsContractId,
        networkPassphrase: this.config.network.networkPassphrase,
        rpcUrl: this.config.network.sorobanRpcUrl,
      });

      const messageIdBuf = hexToBuffer(input.messageId);
      const payloadHash = input.payloadHash ?? computePayloadHash(input.messageId);
      const payloadHashBuf = hexToBuffer(payloadHash);
      const protocolVersion = input.protocolVersion ?? 1;

      const result = await contractDelivered(
        client,
        messageIdBuf,
        payloadHashBuf,
        protocolVersion,
        input.sender,
        input.recipient,
      );

      if (result.isOk()) {
        const res = result.unwrap();
        return {
          messageId: bufferToHex(res.message_id),
          sender: res.sender,
          recipient: res.recipient,
          payloadHash: bufferToHex(res.payload_hash),
          protocolVersion: res.protocol_version,
          deliveredAt: new Date(Number(res.delivered_at) * 1000).toISOString(),
          readAt: res.read_at ? new Date(Number(res.read_at) * 1000).toISOString() : null,
          confirmed: true,
          source: "contract",
        };
      } else {
        const errMessage = result.unwrapErr().message;
        if (errMessage.includes("CommitmentMismatch")) {
          throw new ApiError(
            409,
            "conflict",
            "A delivery receipt already exists for this message with different parameters",
          );
        }
        if (errMessage.includes("DuplicateReceipt")) {
          const onChain = await this.getOnChainReceipt(input.messageId);
          if (onChain) return onChain;
        }
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
    }

    return this.fallback.publishDeliveredReceipt(input);
  }

  async publishReadReceipt(input: PublishReadInput): Promise<ContractReceiptInfo> {
    if (!this.live) {
      return this.fallback.publishReadReceipt(input);
    }

    try {
      const client = createReceiptsClient({
        contractId: this.config.contract.receiptsContractId,
        networkPassphrase: this.config.network.networkPassphrase,
        rpcUrl: this.config.network.sorobanRpcUrl,
      });

      const messageIdBuf = hexToBuffer(input.messageId);
      const result = await contractRead(client, messageIdBuf);

      if (result.isOk()) {
        const res = result.unwrap();
        return {
          messageId: bufferToHex(res.message_id),
          sender: res.sender,
          recipient: res.recipient,
          payloadHash: bufferToHex(res.payload_hash),
          protocolVersion: res.protocol_version,
          deliveredAt: new Date(Number(res.delivered_at) * 1000).toISOString(),
          readAt: res.read_at ? new Date(Number(res.read_at) * 1000).toISOString() : null,
          confirmed: true,
          source: "contract",
        };
      } else {
        const errMessage = result.unwrapErr().message;
        if (errMessage.includes("AlreadyRead")) {
          const onChain = await this.getOnChainReceipt(input.messageId);
          if (onChain) return onChain;
        }
        if (errMessage.includes("ReceiptNotFound")) {
          throw new ApiError(404, "not_found", "Receipt was not found");
        }
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
    }

    return this.fallback.publishReadReceipt(input);
  }

  async getOnChainReceipt(messageId: string): Promise<ContractReceiptInfo | null> {
    if (!this.live) {
      return this.fallback.getOnChainReceipt(messageId);
    }

    try {
      const client = createReceiptsClient({
        contractId: this.config.contract.receiptsContractId,
        networkPassphrase: this.config.network.networkPassphrase,
        rpcUrl: this.config.network.sorobanRpcUrl,
      });

      const messageIdBuf = hexToBuffer(messageId);
      const result = await contractGet(client, messageIdBuf);

      if (result.isOk()) {
        const res = result.unwrap();
        return {
          messageId: bufferToHex(res.message_id),
          sender: res.sender,
          recipient: res.recipient,
          payloadHash: bufferToHex(res.payload_hash),
          protocolVersion: res.protocol_version,
          deliveredAt: new Date(Number(res.delivered_at) * 1000).toISOString(),
          readAt: res.read_at ? new Date(Number(res.read_at) * 1000).toISOString() : null,
          confirmed: true,
          source: "contract",
        };
      }
    } catch {
      // Contract query failed / receipt not found
    }

    return this.fallback.getOnChainReceipt(messageId);
  }
}
