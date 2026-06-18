import type { Email } from "@/components/mail/data";

export type TriageAction = "approve" | "block" | "refund";

export type CardStatus =
  | "idle"
  | "pending-approve"
  | "pending-block"
  | "pending-refund"
  | "success-approve"
  | "success-block"
  | "success-refund"
  | "failure"
  | "undoing";

export interface RequestCardState {
  emailId: string;
  status: CardStatus;
  errorMessage?: string;
}
