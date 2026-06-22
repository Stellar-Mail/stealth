export type ReceiptState = "disabled" | "requested" | "delivered" | "read" | "failed";

export interface ReceiptStateOption {
  /** The receipt state value. */
  state: ReceiptState;
  /** Short, human-readable label. */
  label: string;
  /** What the state means for a demo message. */
  description: string;
  /** A concrete example of when a demo message would be in this state. */
  example: string;
}

export const RECEIPT_STATES: ReceiptState[] = [
  "disabled",
  "requested",
  "delivered",
  "read",
  "failed",
];

export const RECEIPT_STATE_OPTIONS: Record<ReceiptState, ReceiptStateOption> = {
  disabled: {
    state: "disabled",
    label: "Receipts off",
    description: "Read receipts are turned off, so no read status is tracked for this message.",
    example: "A broadcast newsletter sent to a large demo audience with tracking disabled.",
  },
  requested: {
    state: "requested",
    label: "Requested",
    description: "A read receipt was requested but the message has not been delivered yet.",
    example: "A demo message queued to send to a recipient who is currently offline.",
  },
  delivered: {
    state: "delivered",
    label: "Delivered",
    description: "The message reached the recipient's inbox but has not been opened.",
    example: "A welcome email delivered overnight that the recipient has not read yet.",
  },
  read: {
    state: "read",
    label: "Read",
    description: "The recipient opened the message and a read receipt was recorded.",
    example: "A founder opened the onboarding message during the demo walkthrough.",
  },
  failed: {
    state: "failed",
    label: "Failed",
    description: "The read receipt could not be recorded, usually due to a delivery problem.",
    example: "A message to an unknown sender address that bounced before delivery.",
  },
};

export function getReceiptStateOption(state: ReceiptState): ReceiptStateOption {
  return RECEIPT_STATE_OPTIONS[state];
}

export const DEFAULT_RECEIPT_STATE: ReceiptState = "delivered";
