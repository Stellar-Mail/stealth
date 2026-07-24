/**
 * Multi-Agent Assignment Guards
 *
 * Safety and performance constraints for assigning items to multiple agents.
 */

const MAX_AGENTS_PER_ASSIGNMENT = 10;
// Basic UUID validation (v4)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AssignmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssignmentValidationError";
  }
}

/**
 * Validates and sanitizes a list of agent IDs for an assignment operation.
 *
 * @param agentIds - The raw array of agent IDs.
 * @returns A sanitized, deduplicated array of valid agent IDs.
 * @throws AssignmentValidationError if the input violates safety constraints.
 */
export function sanitizeAgentAssignments(agentIds: unknown): string[] {
  if (!Array.isArray(agentIds)) {
    throw new AssignmentValidationError("Agent IDs must be provided as an array.");
  }

  // Cap the number of agents to prevent unnecessary work on large datasets
  if (agentIds.length > MAX_AGENTS_PER_ASSIGNMENT) {
    throw new AssignmentValidationError(
      `Cannot assign more than ${MAX_AGENTS_PER_ASSIGNMENT} agents at once.`,
    );
  }

  const sanitized = new Set<string>();

  for (const id of agentIds) {
    if (typeof id !== "string") {
      throw new AssignmentValidationError("Agent IDs must be strings.");
    }

    const trimmed = id.trim();

    if (!trimmed) {
      continue;
    }

    if (!UUID_REGEX.test(trimmed)) {
      throw new AssignmentValidationError(`Invalid agent ID format: ${trimmed}`);
    }

    sanitized.add(trimmed);
  }

  return Array.from(sanitized);
}

/**
 * Validates the metadata payload associated with an assignment.
 * Prevents large emails or histories from being passed in the event payload.
 *
 * @param payload - The assignment metadata payload.
 */
export function validateAssignmentPayloadSize(payload: Record<string, unknown>): void {
  const payloadString = JSON.stringify(payload);

  // Hard limit on assignment metadata payload (e.g., 5KB)
  // This ensures attachments or full email bodies aren't accidentally included.
  const MAX_PAYLOAD_BYTES = 5 * 1024;

  if (new Blob([payloadString]).size > MAX_PAYLOAD_BYTES) {
    throw new AssignmentValidationError(
      "Assignment payload is too large. Do not include full emails or attachments in the assignment event.",
    );
  }
}
