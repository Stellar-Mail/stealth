/**
 * External sender journey: unknown sender → policy quote → proof/payment → delivery.
 *
 * Steps are intentionally named after what the sender needs to *do*, not
 * internal implementation names, so UI copy can map directly to them.
 */

export type SenderRequestStep =
  | "address-lookup" // Enter recipient Stealth address; resolve to G-address + policy
  | "policy-quote" // Show price/terms before any commitment
  | "identity-proof" // Connect wallet (Freighter or paste G-address)
  | "postage-payment" // Pay / sign postage; show refund terms
  | "delivery-status" // Awaiting delivery confirmation
  | "refund-outcome"; // Refund received or dispute path

/** Direction for step-transition animations. */
export type StepDirection = 1 | -1;

/** The outcome of resolving a recipient address. */
export type AddressResolution = {
  recipientAddress: string; // G-address
  displayHandle: string; // Human-readable input as entered
};

/** Quote returned from the postage API. */
export type PostageQuote = {
  /** Stroop amount as string. "0" means trusted / free. */
  amount: string;
  eligible: boolean;
  reason: "trusted_sender" | "mailbox_minimum" | "sender_blocked";
  trusted: boolean;
  /** XLM decimal for display, derived client-side. */
  amountXlm: string;
};

/** Wallet/identity connected by the sender. */
export type SenderIdentity = {
  /** Stellar G-address. */
  address: string;
  /** How the address was provided. */
  method: "freighter" | "manual";
};

/** Result of submitting the postage transaction. */
export type PostageSubmission = {
  messageId: string;
  paymentHash: string;
  amount: string;
  /** ISO datetime */
  submittedAt: string;
};

/** Terminal outcome of the delivery flow. */
export type DeliveryOutcome =
  | { state: "pending" }
  | { state: "settled" }
  | { state: "refunded"; reason: string }
  | { state: "error"; message: string };

/** Full state threaded through the flow. */
export type SenderRequestState = {
  step: SenderRequestStep;
  direction: StepDirection;

  // Accumulated across steps
  resolution: AddressResolution | null;
  quote: PostageQuote | null;
  identity: SenderIdentity | null;
  submission: PostageSubmission | null;
  outcome: DeliveryOutcome | null;

  // Async state per step
  loading: boolean;
  error: string | null;
};

export const INITIAL_STATE: SenderRequestState = {
  step: "address-lookup",
  direction: 1,
  resolution: null,
  quote: null,
  identity: null,
  submission: null,
  outcome: null,
  loading: false,
  error: null,
};

/** Ordered list used for progress bar. */
export const SENDER_REQUEST_STEPS: SenderRequestStep[] = [
  "address-lookup",
  "policy-quote",
  "identity-proof",
  "postage-payment",
  "delivery-status",
];

export function stepIndex(step: SenderRequestStep): number {
  const i = SENDER_REQUEST_STEPS.indexOf(step);
  return i === -1 ? 0 : i;
}

/** Convert stroop string to XLM display string. */
export function stroopsToXlm(stroops: string): string {
  try {
    const val = Number(BigInt(stroops)) / 10_000_000;
    return val.toLocaleString(undefined, {
      minimumFractionDigits: val === 0 ? 1 : 0,
      maximumFractionDigits: 7,
    });
  } catch {
    return "0";
  }
}
