import {
  Keypair,
  TransactionBuilder,
  Networks,
  Account,
  TimeoutInfinite,
  Transaction,
  Address,
  scValToNative,
} from "@stellar/stellar-sdk";
import type { BetaRuntimeConfig } from "../../config/schema";
import {
  type ManagedWalletRecord,
  type ManagedWalletStore,
  type MasterKeyProvider,
  rewrapManagedWallet,
  sealManagedWalletSeed,
  withManagedWalletSeed,
} from "../crypto/managed-wallet-envelope";
import { type ManagedWalletIntent, validateIntent } from "../../server/api/authorization/intents";
import { recordAuditEvent } from "../../server/api/audit";

export class ManagedWalletService {
  constructor(
    private readonly config: BetaRuntimeConfig,
    private readonly custody?: { store: ManagedWalletStore; keys: MasterKeyProvider },
  ) {}

  public async signTransaction(
    intent: ManagedWalletIntent,
    actorAddress: string,
    transactionXdr: string,
    requestId?: string,
  ): Promise<string> {
    try {
      // 1. Validate intent (throws if invalid)
      validateIntent(intent, actorAddress, this.config);

      // 2. Parse the XDR to verify it matches the intent and doesn't contain arbitrary operations
      let tx: Transaction;
      const networkPassphrase = this.config.network.networkPassphrase;
      try {
        tx = new Transaction(transactionXdr, networkPassphrase);
      } catch (err) {
        throw new Error("Invalid transaction XDR");
      }

      // We only allow one operation per intent for strictness
      if (tx.operations.length !== 1) {
        throw new Error("Managed wallet only signs single-operation transactions");
      }

      const op = tx.operations[0];
      if (op.type !== "invokeHostFunction") {
        throw new Error("Only invokeHostFunction operations are allowed");
      }

      // TODO: Perform deep inspection of the host function invocation here to ensure it
      // perfectly aligns with the validated `intent`. This satisfies the "Arbitrary transaction XDR
      // cannot be submitted for signing" requirement.
      this.verifyOperationMatchesIntent(op, intent, this.config);

      // 3. Sign the transaction
      await this.signWithCustody(actorAddress, tx);

      // 4. Emit success audit event
      recordAuditEvent({
        actor: actorAddress,
        action: "managed_wallet.signed",
        targetType: intent.type,
        safeTargetReference: this.getSafeTargetReference(intent),
        result: "success",
        requestId: requestId ?? "unknown",
      });

      return tx.toXDR();
    } catch (error: any) {
      // Emit denied audit event
      recordAuditEvent({
        actor: actorAddress,
        action: "managed_wallet.rejected",
        targetType: intent.type,
        safeTargetReference: this.getSafeTargetReference(intent),
        result: "denied",
        requestId: requestId ?? "unknown",
      });
      throw error;
    }
  }
  /** Provisioning is intentionally separate from signing and stores only a sealed record. */
  public async provisionWallet(owner: string, seed: string): Promise<ManagedWalletRecord> {
    if (!this.custody) throw new Error("Managed wallet custody is not configured");
    const address = Keypair.fromSecret(seed).publicKey();
    const existing = await this.custody.store.get(owner);
    if (existing) {
      if (existing.envelope.address !== address) throw new Error("Managed wallet already exists");
      return existing; // duplicate provisioning is safe and does not rotate key material.
    }
    const record: ManagedWalletRecord = {
      owner,
      envelope: await sealManagedWalletSeed(seed, address, this.custody.keys),
      updatedAt: new Date().toISOString(),
    };
    if (!(await this.custody.store.compareAndSet(owner, null, record))) {
      const raced = await this.custody.store.get(owner);
      if (raced?.envelope.address === address) return raced;
      throw new Error("Managed wallet provisioning conflict");
    }
    return record;
  }

  /** Rotation rewraps the data key only; the encrypted seed and Stellar address remain unchanged. */
  public async rotateWalletKey(
    owner: string,
    targetVersion?: string,
  ): Promise<ManagedWalletRecord> {
    if (!this.custody) throw new Error("Managed wallet custody is not configured");
    const current = await this.custody.store.get(owner);
    if (!current) throw new Error("Managed wallet was not found");
    const envelope = await rewrapManagedWallet(current.envelope, this.custody.keys, targetVersion);
    if (envelope === current.envelope) return current;
    const updated = { ...current, envelope, updatedAt: new Date().toISOString() };
    if (!(await this.custody.store.compareAndSet(owner, current.updatedAt, updated))) {
      throw new Error("Managed wallet rotation conflict");
    }
    return updated;
  }

  private async signWithCustody(owner: string, tx: Transaction): Promise<void> {
    if (this.custody) {
      const record = await this.custody.store.get(owner);
      if (!record || record.owner !== owner) throw new Error("Managed wallet access denied");
      return withManagedWalletSeed(record.envelope, this.custody.keys, (seed) => {
        const keypair = Keypair.fromSecret(seed);
        if (keypair.publicKey() !== record.envelope.address)
          throw new Error("Managed wallet integrity check failed");
        tx.sign(keypair);
      });
    }
    const operatorSecret = this.config.secrets?.operatorSecret;
    if (!operatorSecret) throw new Error("Managed wallet not configured");
    tx.sign(Keypair.fromSecret(operatorSecret));
  }

  private getSafeTargetReference(intent: ManagedWalletIntent): string {
    switch (intent.type) {
      case "policy":
        return `policy:${intent.ownerAddress}`;
      case "postage":
        return `postage:${intent.senderAddress}`;
      case "lifecycle":
        return `lifecycle:${intent.userAddress}`;
      case "receipt":
        return `receipt:${intent.recipientAddress}`;
      case "keys":
        return `keys:${intent.ownerAddress}:${intent.operation}`;
    }
  }

  private verifyOperationMatchesIntent(
    op: any,
    intent: ManagedWalletIntent,
    config: BetaRuntimeConfig,
  ) {
    if (op.type !== "invokeHostFunction") {
      throw new Error("Only invokeHostFunction operations are allowed");
    }

    const func = op.func;
    if (func.switch().name !== "hostFunctionTypeInvokeContract") {
      throw new Error("Only contract invocations are allowed");
    }

    const invoke = func.invokeContract();

    // Verify contract ID and extract function name and arguments
    const contractAddress = Address.fromScAddress(invoke.contractAddress()).toString();
    const functionName = invoke.functionName().toString("utf-8");
    const args = invoke.args().map((arg: any) => scValToNative(arg));

    if (intent.type === "policy") {
      if (contractAddress !== config.contract.policiesContractId) {
        throw new Error("Invalid contract ID for policy intent");
      }
      const allowedFuncs = [
        "set_policy",
        "set_policy_as",
        "set_sender_rule",
        "set_sender_rule_as",
        "set_sender_tier",
        "set_sender_tier_as",
      ];
      if (!allowedFuncs.includes(functionName)) {
        throw new Error(`Function ${functionName} is not allowed for policy intents`);
      }
      const targetOwner = args[0];
      if (targetOwner !== intent.ownerAddress) {
        throw new Error(`Transaction alters policy for a different owner: ${targetOwner}`);
      }
    } else if (intent.type === "postage") {
      if (contractAddress !== config.contract.postageContractId) {
        throw new Error("Invalid contract ID for postage intent");
      }
      const allowedFuncs = ["submit", "settle", "refund", "dispute", "expire", "reclaim"];
      if (!allowedFuncs.includes(functionName)) {
        throw new Error(`Function ${functionName} is not allowed for postage intents`);
      }
      if (functionName === "submit") {
        const targetSender = args[1]; // sender is the 2nd argument in submit()
        if (targetSender !== intent.senderAddress) {
          throw new Error(`Transaction submits postage for a different sender: ${targetSender}`);
        }
      }
    } else if (intent.type === "lifecycle") {
      if (contractAddress !== config.contract.registryContractId) {
        throw new Error("Invalid contract ID for lifecycle intent");
      }
      const allowedFuncs = ["set_delegate", "update_account"];
      if (!allowedFuncs.includes(functionName)) {
        throw new Error(`Function ${functionName} is not allowed for lifecycle intents`);
      }
      const targetUser = args[0];
      if (targetUser !== intent.userAddress) {
        throw new Error(`Transaction alters lifecycle for a different user: ${targetUser}`);
      }
    } else if (intent.type === "receipt") {
      if (contractAddress !== config.contract.receiptsContractId) {
        throw new Error("Invalid contract ID for receipt intent");
      }
      const allowedFuncs = ["emit_receipt", "record_delivery"];
      if (!allowedFuncs.includes(functionName)) {
        throw new Error(`Function ${functionName} is not allowed for receipt intents`);
      }
      const targetRecipient = args[0];
      if (targetRecipient !== intent.recipientAddress) {
        throw new Error(`Transaction emits receipt for a different recipient: ${targetRecipient}`);
      }
    } else if (intent.type === "keys") {
      throw new Error("Managed wallet does not sign key directory transactions");
    }
  }
}
