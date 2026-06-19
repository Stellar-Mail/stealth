export type OTPType = "email" | "passkey" | "sms";

export interface OTPFixture {
  id: string;
  senderLabel: string;
  senderDomain: string;
  type: OTPType;
  safeCode: string;
  messagePreview: string;
  status: "delivered" | "pending" | "failed";
  timestamp: string;
}
