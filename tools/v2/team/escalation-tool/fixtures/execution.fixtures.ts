import type { EscalationInput } from "../types/contract";
import type { EscalationRepository } from "../services/execution.service";

/** Deterministic successful escalation input. */
export const successfulEscalationInput: EscalationInput = {
  conversationId: "conv-102938",
  reason: "SLA threshold breached — customer waiting over 4 hours for security review",
  priority: "high",
  requestedBy: "agent-alice-42",
  targetDepartment: "compliance",
  notes: "Customer requires verification of proof certificate",
  correlationId: "corr-778899",
};

/** Failure fixture: missing required conversationId. */
export const missingConversationIdInput: EscalationInput = {
  conversationId: "   ",
  reason: "Unresolved refund inquiry",
  priority: "medium",
  requestedBy: "agent-bob-12",
};

/** Failure fixture: missing required reason. */
export const missingReasonInput: EscalationInput = {
  conversationId: "conv-445566",
  reason: "",
  priority: "low",
  requestedBy: "agent-charlie-99",
};

/** Failure fixture: invalid priority value. */
export const invalidPriorityInput: EscalationInput = {
  conversationId: "conv-889900",
  reason: "Needs tier-2 tech analysis",
  priority: "critical" as any,
  requestedBy: "agent-dave-01",
};

/** Mock repository that simulates a persistence failure. */
export const failingRepository: EscalationRepository = {
  save: async () => {
    throw new Error("Database connection timeout");
  },
};
