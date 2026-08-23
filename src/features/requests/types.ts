import type { Email } from "@/components/mail/data";

export type TriageAction = "approve_once" | "always_allow" | "reject" | "block";

export type CardStatus =
  | "idle"
  | "pending-approve_once"
  | "pending-always_allow"
  | "pending-reject"
  | "pending-block"
  | "success-approve_once"
  | "success-always_allow"
  | "success-reject"
  | "success-block"
  | "failure"
  | "undoing";

export interface RequestCardState {
  emailId: string;
  status: CardStatus;
  errorMessage?: string;
}
