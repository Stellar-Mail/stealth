import {
  DealLeadTrackerInput,
  DealLeadTrackerOutput,
  DealLeadTrackerErrorCode,
  DealLeadTrackerError,
} from "./contract";

/**
 * Non-UI service entry point for processing deal/lead emails.
 */
export async function executeDealLeadMailTracker(
  input: DealLeadTrackerInput,
): Promise<DealLeadTrackerOutput> {
  if (!input.emailId || !input.senderAddress || !input.contentBody) {
    throw new DealLeadTrackerError(
      "Missing required fields: emailId, senderAddress, or contentBody",
      DealLeadTrackerErrorCode.INVALID_INPUT,
    );
  }

  // Basic mock implementation simulating execution
  try {
    const isDeal =
      input.contentBody.toLowerCase().includes("deal") ||
      input.contentBody.toLowerCase().includes("lead");

    return {
      isDealLead: isDeal,
      confidenceScore: isDeal ? 0.95 : 0.1,
      extractedEntities: isDeal
        ? {
            companyName: "Acme Corp",
            dealSize: 50000,
            currency: "USD",
          }
        : undefined,
      processedAt: new Date(),
    };
  } catch (error) {
    throw new DealLeadTrackerError(
      "Failed to parse email content",
      DealLeadTrackerErrorCode.PARSING_ERROR,
    );
  }
}
