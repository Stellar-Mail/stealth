import type {
  EscalationErrorCode,
  EscalationInput,
  EscalationPriority,
  EscalationRecord,
  EscalationToolResult,
} from "../types/contract";

/** Optional persistence boundary for storing escalation records. */
export interface EscalationRepository {
  save(record: EscalationRecord): Promise<void>;
}

export interface EscalationToolDependencies {
  repository?: EscalationRepository;
  generateId?: () => string;
  now?: () => Date;
}

const VALID_PRIORITIES = new Set<EscalationPriority>(["low", "medium", "high", "urgent"]);

function failure(code: EscalationErrorCode, message: string, field?: string): EscalationToolResult {
  return { ok: false, error: { code, message, ...(field ? { field } : {}) } };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateInput(input: EscalationInput): EscalationToolResult | undefined {
  if (!input || typeof input !== "object") {
    return failure("INVALID_INPUT", "Input must be a valid object");
  }

  const requiredFields: Array<[keyof EscalationInput, unknown]> = [
    ["conversationId", input.conversationId],
    ["reason", input.reason],
    ["requestedBy", input.requestedBy],
  ];

  for (const [field, value] of requiredFields) {
    if (!nonEmptyString(value)) {
      return failure("INVALID_INPUT", `${field} must be a non-empty string`, field);
    }
  }

  if (!input.priority || !VALID_PRIORITIES.has(input.priority)) {
    return failure(
      "INVALID_PRIORITY",
      `priority must be one of: ${Array.from(VALID_PRIORITIES).join(", ")}`,
      "priority",
    );
  }
}

function defaultGenerateId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `esc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  );
}

/**
 * Creates a presentation-independent escalation service with injectable clock, ID generation, and storage repository.
 */
export function createEscalationToolService(dependencies: EscalationToolDependencies = {}) {
  const generateId = dependencies.generateId ?? defaultGenerateId;
  const now = dependencies.now ?? (() => new Date());

  async function execute(input: EscalationInput): Promise<EscalationToolResult> {
    try {
      const validationFailure = validateInput(input);
      if (validationFailure) return validationFailure;

      const record: EscalationRecord = {
        id: generateId(),
        conversationId: input.conversationId.trim(),
        reason: input.reason.trim(),
        priority: input.priority,
        requestedBy: input.requestedBy.trim(),
        targetDepartment: input.targetDepartment?.trim() || "general-support",
        status: "open",
        createdAt: now().toISOString(),
        ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
        ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
      };

      if (dependencies.repository) {
        try {
          await dependencies.repository.save(record);
        } catch {
          return failure("PERSISTENCE_FAILED", "The escalation record could not be persisted");
        }
      }

      return { ok: true, data: record };
    } catch {
      return failure("INTERNAL_ERROR", "Escalation tool execution failed unexpectedly");
    }
  }

  return { execute };
}

/** Default backend-facing entry point operating in-memory. */
export const escalationToolService = createEscalationToolService();

export type EscalationToolService = ReturnType<typeof createEscalationToolService>;
