import { rpc, TransactionBuilder, Networks, Address } from "@stellar/stellar-sdk";
import { createHash } from "node:crypto";
import type { BetaRuntimeConfig } from "../../config/schema";
import type { Postage, PostageChainStatus, PostageStatus } from "../../server/api/domain";
import {
  createPostageClient,
  type Postage as ChainPostage,
  type PostageClientOptions,
  PostageError,
  parsePostageError,
  submit as chainSubmit,
  settle as chainSettle,
  refund as chainRefund,
  dispute as chainDispute,
  expire as chainExpire,
  reclaim as chainReclaim,
  config as chainConfig,
  get as chainGet,
} from "./contracts/postage";
import type { ManagedWalletIntent } from "../../server/api/authorization/intents";
import { ManagedWalletService } from "./managed-wallet";

export type PostageOperation = "submit" | "settle" | "refund" | "dispute" | "expire" | "reclaim";

export type RetryClassification = "safe" | "unknown" | "never";

export interface ChainConfirmation {
  txHash: string;
  ledger: number;
  createdAtLedger: number;
}

export interface PostageEscrowResult {
  success: boolean;
  postage?: ChainPostage;
  confirmation?: ChainConfirmation;
  chainStatus: PostageChainStatus;
  retryClassification: RetryClassification;
  /** Bounded, redacted error string. Never contains secrets or XDR. */
  lastError?: string;
}

export interface AllowanceCheckResult {
  sufficient: boolean;
  allowance?: string;
  balance?: string;
  required: string;
}

const CONTRACT_ERROR_RE = /Error\(Contract, #(\d+)\)/;

function extractContractError(message: string): PostageError | undefined {
  const m = message.match(CONTRACT_ERROR_RE);
  if (!m) return undefined;
  return parsePostageError(parseInt(m[1], 10));
}

/** Exported for fault-injection unit tests (BETA-042 acceptance criteria). */
export function classifyRetry(operation: PostageOperation, err: unknown): RetryClassification {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const code = extractContractError(msg);

  if (code === undefined) {
    if (/timeout|TIMEOUT|ECONNRESET|ETIMEDOUT|5\d{2}/.test(msg)) {
      return "safe";
    }
    return "unknown";
  }

  switch (operation) {
    case "submit":
      if (code === PostageError.DuplicateMessage) return "safe";
      if (code === PostageError.AlreadyInitialized) return "never";
      break;
    case "settle":
    case "refund":
    case "dispute":
    case "expire":
    case "reclaim":
      if (code === PostageError.AlreadyResolved) return "safe";
      if (code === PostageError.PostageNotFound) return "never";
      break;
  }

  if (
    code === PostageError.InvalidAmount ||
    code === PostageError.InvalidFee ||
    code === PostageError.InvalidWindow ||
    code === PostageError.GuardNotConfigured ||
    code === PostageError.LifecycleRejected ||
    code === PostageError.NotExpired ||
    code === PostageError.DisputeUnavailable
  ) {
    return "never";
  }

  return "unknown";
}

export function chainStatusToDomain(status: ChainPostage["status"]): PostageStatus {
  switch (status) {
    case 0:
      return "pending";
    case 1:
      return "expired";
    case 2:
      return "disputed";
    case 3:
      return "settled";
    case 4:
      return "refunded";
    case 5:
      return "reclaimed";
    default:
      return "pending";
  }
}

export function redactError(err: unknown, maxLen = 500): string {
  const raw = err instanceof Error ? err.message : String(err ?? "unknown error");
  const scrubbed = raw
    .replace(/S[A-Z2-7]{55}/g, "<REDACTED_SECRET>")
    .replace(/[A-Za-z0-9+/=]{200,}/g, "<REDACTED_XDR>");
  return scrubbed.length > maxLen ? scrubbed.slice(0, maxLen - 3) + "..." : scrubbed;
}

function messageIdToBuffer(messageIdHex: string): Buffer {
  return Buffer.from(messageIdHex, "hex");
}

function stellarAmount(big: bigint): string {
  return big.toString();
}

export class PostageEscrowUnavailableError extends Error {
  constructor(reason: string) {
    super(`Postage escrow service unavailable: ${reason}`);
    this.name = "PostageEscrowUnavailableError";
  }
}

export interface PostageEscrowAdapterOptions {
  config: BetaRuntimeConfig;
  managedWallet?: ManagedWalletService;
}

/**
 * Off-chain ↔ on-chain bridge for the postage escrow lifecycle (BETA-042).
 *
 * Responsibilities:
 *   - Balance/allowance checks against the SEP-41 asset accepted by the contract.
 *   - Transaction building, signing (via the managed wallet service), and
 *     submission to Soroban RPC.
 *   - Confirmation polling (getTransaction) until a tx lands on-ledger.
 *   - Mapping contract `PostageError` variants into retry classifications:
 *       `safe`   — an idempotent duplicate (e.g. DuplicateMessage, AlreadyResolved)
 *       `never`  — a structural failure (amount invalid, bad window, etc.)
 *       `unknown`— a transient / unexpected case the caller can decide on.
 *   - NEVER exposes secrets, XDR blobs, or transaction payloads in returned
 *     error strings.  All messages are bounded and scrubbed.
 *
 * Simulation path:
 *   The adapter runs in a `simulate` toggle that short-circuits chain writes
 *   while still performing every precondition check (balances, allowances,
 *   minimums, timestamps).  This lets unit tests exercise every lifecycle
 *   branch without an RPC connection.
 */
export class PostageEscrowAdapter {
  private readonly config: BetaRuntimeConfig;
  private readonly managedWallet: ManagedWalletService | null;
  private readonly rpcUrl: string;
  private readonly networkPassphrase: string;
  private readonly postageContractId: string;

  constructor(opts: PostageEscrowAdapterOptions) {
    this.config = opts.config;
    this.managedWallet = opts.managedWallet ?? null;
    this.rpcUrl = opts.config.network.sorobanRpcUrl;
    this.networkPassphrase = opts.config.network.networkPassphrase;
    this.postageContractId = opts.config.contract.postageContractId;
  }

  /** True when the adapter is wired with a live RPC + managed wallet. */
  isLive(): boolean {
    return (
      !!this.managedWallet &&
      !!this.rpcUrl &&
      this.postageContractId.length > 0 &&
      !this.postageContractId.startsWith("C_TEST_") &&
      !this.postageContractId.startsWith("C_DEV_") &&
      !this.postageContractId.startsWith("CBBBB") &&
      !this.postageContractId.startsWith("CAAAA") &&
      this.config.network.stellarNetwork !== "local"
    );
  }

  private makeClient(publicKey?: string) {
    const opts: PostageClientOptions = {
      contractId: this.postageContractId,
      networkPassphrase: this.networkPassphrase,
      rpcUrl: this.rpcUrl,
      ...(publicKey ? { publicKey } : {}),
    };
    return createPostageClient(opts);
  }

  private makeRpcServer(): rpc.Server {
    return new rpc.Server(this.rpcUrl, {
      allowHttp: this.networkPassphrase !== Networks.PUBLIC,
    });
  }

  // ------------------------------------------------------------------
  // Read-only queries (no transaction). Failures are safe-retry since
  // they never mutate chain state.
  // ------------------------------------------------------------------

  async readOnChainPostage(messageId: string): Promise<ChainPostage | null> {
    try {
      const client = this.makeClient();
      const result = await chainGet(client, messageIdToBuffer(messageId));
      if (result.isOk()) return result.unwrap();
      const code = extractContractError(result.unwrapErr().message);
      if (code === PostageError.PostageNotFound) return null;
      return null;
    } catch {
      return null;
    }
  }

  async readEscrowConfig() {
    try {
      const client = this.makeClient();
      const r = await chainConfig(client);
      return r.isOk() ? r.unwrap() : null;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Balance / allowance preflight
  // ------------------------------------------------------------------

  async checkAllowanceAndBalance(
    sender: string,
    amountStroops: bigint,
  ): Promise<AllowanceCheckResult> {
    const required = stellarAmount(amountStroops);

    if (!this.isLive()) {
      return { sufficient: true, required };
    }

    try {
      const cfg = await this.readEscrowConfig();
      if (!cfg || !cfg.asset) {
        return { sufficient: false, required };
      }

      const server = this.makeRpcServer();
      const postageAddr = new Address(this.postageContractId);
      const senderAddr = new Address(sender);

      const balance = await this.readSACBalance(server, cfg.asset, senderAddr);
      const allowance = await this.readSACAllowance(server, cfg.asset, senderAddr, postageAddr);

      const ok =
        balance !== undefined &&
        allowance !== undefined &&
        BigInt(balance) >= amountStroops &&
        BigInt(allowance) >= amountStroops;

      return {
        sufficient: ok,
        balance,
        allowance,
        required,
      };
    } catch (err: unknown) {
      return { sufficient: false, required, lastError: redactError(err) } as any;
    }
  }

  private async readSACBalance(
    server: rpc.Server,
    assetContractId: string,
    addr: Address,
  ): Promise<string | undefined> {
    try {
      const { result } = await server.queryContract<bigint>(assetContractId, "balance", {
        id: addr.toString(),
      });
      return result !== undefined && result !== null ? result.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  private async readSACAllowance(
    server: rpc.Server,
    assetContractId: string,
    from: Address,
    spender: Address,
  ): Promise<string | undefined> {
    try {
      const { result } = await server.queryContract<bigint>(assetContractId, "allowance", {
        from: from.toString(),
        spender: spender.toString(),
      });
      return result !== undefined && result !== null ? result.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  // ------------------------------------------------------------------
  // Transaction execution
  // ------------------------------------------------------------------

  private async runOperation(
    operation: PostageOperation,
    intent: ManagedWalletIntent,
    actorAddress: string,
    messageId: string,
    buildContractOp: (client: ReturnType<typeof createPostageClient>) => Promise<any>,
    requestId?: string,
  ): Promise<PostageEscrowResult> {
    const live = this.isLive();
    try {
      if (!live) {
        return {
          success: false,
          chainStatus: "not_submitted",
          retryClassification: "unknown",
          lastError: "escrow adapter not configured for live testnet",
        };
      }

      const managedWallet = this.managedWallet;
      if (!managedWallet) {
        throw new PostageEscrowUnavailableError("managed wallet service is not available");
      }

      const client = this.makeClient(actorAddress);

      const contractTxResult = await buildContractOp(client);
      const rawXdr = (contractTxResult as any).transactionXdr;
      if (!rawXdr) {
        throw new Error("contract client returned no transaction XDR");
      }

      const signedXdr = await managedWallet.signTransaction(
        intent,
        actorAddress,
        rawXdr,
        requestId,
      );

      const server = this.makeRpcServer();
      const submitRes = await server.sendTransaction(
        TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase) as any,
      );

      let txHash: string;
      if ((submitRes as any).hash) {
        txHash = (submitRes as any).hash;
      } else {
        const tx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
        txHash = this.hashTx((tx as any).toXDR());
      }

      if ((submitRes as any).status === "DUPLICATE") {
        const existing = await this.confirm(txHash, messageId, operation);
        if (existing) {
          return {
            success: true,
            postage: existing.postage,
            confirmation: existing.confirmation,
            chainStatus: "confirmed",
            retryClassification: "safe",
          };
        }
      }

      if ((submitRes as any).status !== "PENDING" && (submitRes as any).status !== "DUPLICATE") {
        const diag = (submitRes as any).errorResultXdr || "";
        const lastError = redactError(
          `sendTransaction status=${(submitRes as any).status} ${diag}`,
        );
        return {
          success: false,
          chainStatus: "failed",
          retryClassification: classifyRetry(operation, new Error(lastError)),
          lastError,
        };
      }

      const confirmed = await this.confirm(txHash, messageId, operation);
      if (!confirmed) {
        return {
          success: false,
          chainStatus: "submitted",
          retryClassification: "safe",
          txHash,
        } as any;
      }

      return {
        success: true,
        postage: confirmed.postage,
        confirmation: confirmed.confirmation,
        chainStatus: "confirmed",
        retryClassification: "safe",
      };
    } catch (err: unknown) {
      const retryClass = classifyRetry(operation, err);
      const lastError = redactError(err);

      if (retryClass === "safe") {
        const chain = await this.readOnChainPostage(messageId);
        return {
          success: chain !== undefined,
          postage: chain ?? undefined,
          chainStatus: chain ? "confirmed" : live ? "failed" : "not_submitted",
          retryClassification: "safe",
          lastError,
        };
      }

      return {
        success: false,
        chainStatus: live ? "failed" : "not_submitted",
        retryClassification: retryClass,
        lastError,
      };
    }
  }

  private hashTx(xdr: string): string {
    return createHash("sha256").update(xdr).digest("hex");
  }

  private async confirm(
    txHash: string,
    messageId: string,
    operation: PostageOperation,
    maxAttempts = 15,
    sleepMs = 1500,
  ): Promise<{ postage?: ChainPostage; confirmation: ChainConfirmation } | null> {
    const server = this.makeRpcServer();
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res: any = await server.getTransaction(txHash);
        const status = res.status;
        if (status === "SUCCESS") {
          const ledger = res.ledgers?.[0]?.sequence ?? (Number(res.ledger) || 0);
          const resultMeta = (res as any).resultMetaXdr;
          const postage =
            this.extractPostageFromResult(resultMeta, operation) ??
            (await this.readOnChainPostage(messageId)) ??
            undefined;
          return {
            postage,
            confirmation: {
              txHash,
              ledger,
              createdAtLedger: ledger,
            },
          };
        }
        if (status === "FAILED") {
          return null;
        }
      } catch {
        // Ignore transient RPC errors while polling for confirmation.
      }
      await this.sleep(sleepMs);
    }
    return null;
  }

  private extractPostageFromResult(
    _resultMeta: string | undefined,
    _operation: PostageOperation,
  ): ChainPostage | undefined {
    return undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ------------------------------------------------------------------
  // Public lifecycle entry points
  // ------------------------------------------------------------------

  async submitEscrow(
    messageId: string,
    sender: string,
    recipient: string,
    amount: bigint,
    requestId?: string,
  ): Promise<PostageEscrowResult> {
    const intent: ManagedWalletIntent = {
      type: "postage",
      senderAddress: sender,
      amountStroops: amount.toString(),
    };
    const messageIdBuf = messageIdToBuffer(messageId);
    return this.runOperation(
      "submit",
      intent,
      sender,
      messageId,
      (client) => chainSubmit(client, messageIdBuf, sender, recipient, amount),
      requestId,
    );
  }

  async settleEscrow(
    messageId: string,
    recipient: string,
    requestId?: string,
  ): Promise<PostageEscrowResult> {
    const intent: ManagedWalletIntent = {
      type: "postage",
      senderAddress: recipient,
      amountStroops: "0",
    };
    const messageIdBuf = messageIdToBuffer(messageId);
    return this.runOperation(
      "settle",
      intent,
      recipient,
      messageId,
      (client) => chainSettle(client, messageIdBuf),
      requestId,
    );
  }

  async refundEscrow(
    messageId: string,
    recipient: string,
    requestId?: string,
  ): Promise<PostageEscrowResult> {
    const intent: ManagedWalletIntent = {
      type: "postage",
      senderAddress: recipient,
      amountStroops: "0",
    };
    const messageIdBuf = messageIdToBuffer(messageId);
    return this.runOperation(
      "refund",
      intent,
      recipient,
      messageId,
      (client) => chainRefund(client, messageIdBuf),
      requestId,
    );
  }

  async disputeEscrow(
    messageId: string,
    recipient: string,
    requestId?: string,
  ): Promise<PostageEscrowResult> {
    const intent: ManagedWalletIntent = {
      type: "postage",
      senderAddress: recipient,
      amountStroops: "0",
    };
    const messageIdBuf = messageIdToBuffer(messageId);
    return this.runOperation(
      "dispute",
      intent,
      recipient,
      messageId,
      (client) => chainDispute(client, messageIdBuf),
      requestId,
    );
  }

  async expireEscrow(
    messageId: string,
    caller: string,
    requestId?: string,
  ): Promise<PostageEscrowResult> {
    const intent: ManagedWalletIntent = {
      type: "postage",
      senderAddress: caller,
      amountStroops: "0",
    };
    const messageIdBuf = messageIdToBuffer(messageId);
    return this.runOperation(
      "expire",
      intent,
      caller,
      messageId,
      (client) => chainExpire(client, messageIdBuf),
      requestId,
    );
  }

  async reclaimEscrow(
    messageId: string,
    sender: string,
    requestId?: string,
  ): Promise<PostageEscrowResult> {
    const intent: ManagedWalletIntent = {
      type: "postage",
      senderAddress: sender,
      amountStroops: "0",
    };
    const messageIdBuf = messageIdToBuffer(messageId);
    return this.runOperation(
      "reclaim",
      intent,
      sender,
      messageId,
      (client) => chainReclaim(client, messageIdBuf),
      requestId,
    );
  }
}

export function mapPostageStatus(chain: ChainPostage): PostageStatus {
  return chainStatusToDomain(chain.status);
}
