import type { BetaRuntimeConfig } from "../../../config/schema";

export type ManagedWalletIntent =
  | { type: "policy"; ownerAddress: string }
  | { type: "postage"; senderAddress: string; amountStroops: string }
  | { type: "lifecycle"; userAddress: string }
  | { type: "receipt"; recipientAddress: string }
  | {
      type: "keys";
      ownerAddress: string;
      operation: "publish" | "rotate" | "retire" | "revoke";
      keyId?: string;
    };

export function validateIntent(
  intent: ManagedWalletIntent,
  actorAddress: string,
  config: BetaRuntimeConfig,
) {
  // 1. Enforce Beta network restrictions: refuse Mainnet
  if (config.network.stellarNetwork === "mainnet") {
    throw new Error("Refusing to sign mainnet transactions in beta configuration");
  }

  // 2. Validate actor ownership matches the intent's subject
  switch (intent.type) {
    case "policy":
      if (intent.ownerAddress !== actorAddress) {
        throw new Error("Actor mismatch: cannot sign policy update for another user");
      }
      break;
    case "postage":
      if (intent.senderAddress !== actorAddress) {
        throw new Error("Actor mismatch: cannot sign postage settlement for another user");
      }
      // 3. Amount ceilings for postage
      if (BigInt(intent.amountStroops) > 1000000000n) {
        // 100 XLM max per postage
        throw new Error("Postage amount exceeds the maximum allowed ceiling");
      }
      break;
    case "lifecycle":
      if (intent.userAddress !== actorAddress) {
        throw new Error("Actor mismatch: cannot sign lifecycle changes for another user");
      }
      break;
    case "receipt":
      if (intent.recipientAddress !== actorAddress) {
        throw new Error("Actor mismatch: cannot sign receipt emission for another user");
      }
      break;
    case "keys":
      if (intent.ownerAddress !== actorAddress) {
        throw new Error("Actor mismatch: cannot sign key directory operation for another user");
      }
      break;
    default:
      throw new Error("Unknown intent type");
  }

  return true;
}
