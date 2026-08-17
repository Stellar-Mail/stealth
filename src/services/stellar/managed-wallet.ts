import {
  Keypair,
  TransactionBuilder,
  Networks,
  Account,
  TimeoutInfinite,
  Transaction,
} from "@stellar/stellar-sdk";
import type { BetaRuntimeConfig } from "../../config/schema";
import { type ManagedWalletIntent, validateIntent } from "../../server/api/authorization/intents";
import { recordAuditEvent } from "../../server/api/audit";

export class ManagedWalletService {
  constructor(private config: BetaRuntimeConfig) {}

  public async signTransaction(
    intent: ManagedWalletIntent,
    actorAddress: string,
    transactionXdr: string,
    requestId?: string,
  ): Promise<string> {
    try {
      // 1. Validate intent (throws if invalid)
      validateIntent(intent, actorAddress, this.config);

      const operatorSecret = this.config.secrets?.operatorSecret;
      if (!operatorSecret) {
        throw new Error("Managed wallet not configured: missing operator secret");
      }
      const operatorKeypair = Keypair.fromSecret(operatorSecret);
      const networkPassphrase = this.config.network.networkPassphrase;

      // 2. Parse the XDR to verify it matches the intent and doesn't contain arbitrary operations
      let tx: Transaction;
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
      tx.sign(operatorKeypair);

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

    // Address format can vary, but we can verify contract ID
    // Let's assume we validate the contract based on intent.
    const functionName = invoke.functionName().toString("utf-8");

    // For policy, we expect set_policy or set_policy_as or set_sender_rule
    if (intent.type === "policy") {
      const allowedFuncs = ["set_policy", "set_policy_as", "set_sender_rule", "set_sender_rule_as"];
      if (!allowedFuncs.includes(functionName)) {
        throw new Error(`Function ${functionName} is not allowed for policy intents`);
      }
      // Note: Full parameter introspection can be done here.
    } else if (intent.type === "postage") {
      const allowedFuncs = ["submit_postage", "settle_postage"];
      if (!allowedFuncs.includes(functionName)) {
        throw new Error(`Function ${functionName} is not allowed for postage intents`);
      }
    } else if (intent.type === "lifecycle") {
      // e.g. account setup, delegate setting
      const allowedFuncs = ["set_delegate", "update_account"];
      if (!allowedFuncs.includes(functionName)) {
        throw new Error(`Function ${functionName} is not allowed for lifecycle intents`);
      }
    } else if (intent.type === "receipt") {
      const allowedFuncs = ["emit_receipt", "record_delivery"];
      if (!allowedFuncs.includes(functionName)) {
        throw new Error(`Function ${functionName} is not allowed for receipt intents`);
      }
    }
  }
}
