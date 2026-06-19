export type JourneyStage = "address" | "quote" | "identity" | "payment" | "delivery" | "refund";

export interface JourneyState {
  stage: JourneyStage;
  recipientAddress: string;
  postageAmount: string;
  subject: string;
  body: string;
  identityVerified: boolean;
  paymentStatus: "idle" | "pending" | "success" | "failed";
  deliveryStatus: "idle" | "pending" | "delivered" | "failed";
  refundAvailable: boolean;
}

export const DEFAULT_JOURNEY_STATE: JourneyState = {
  stage: "address",
  recipientAddress: "",
  postageAmount: "0.0001",
  subject: "",
  body: "",
  identityVerified: false,
  paymentStatus: "idle",
  deliveryStatus: "idle",
  refundAvailable: true,
};
