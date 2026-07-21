import type {
  ApprovalChain,
  ApprovalChainBuilderInput,
  ApprovalChainBuilderResult,
  ApprovalChainErrorCode,
  ApprovalStage,
} from "../types/contract";

/** Optional persistence boundary. Transport and storage details stay outside this tool. */
export interface ApprovalChainRepository {
  save(chain: ApprovalChain): Promise<void>;
}

export interface ApprovalChainBuilderDependencies {
  repository?: ApprovalChainRepository;
  generateId?: () => string;
  now?: () => Date;
}

function failure(
  code: ApprovalChainErrorCode,
  message: string,
  field?: string,
): ApprovalChainBuilderResult {
  return { ok: false, error: { code, message, ...(field ? { field } : {}) } };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateInput(input: ApprovalChainBuilderInput): ApprovalChainBuilderResult | undefined {
  const requiredStrings: Array<[keyof ApprovalChainBuilderInput, unknown]> = [
    ["subjectId", input?.subjectId],
    ["subjectType", input?.subjectType],
    ["name", input?.name],
    ["createdBy", input?.createdBy],
  ];

  for (const [field, value] of requiredStrings) {
    if (!nonEmptyString(value)) {
      return failure("INVALID_INPUT", `${field} must be a non-empty string`, field);
    }
  }

  if (!Array.isArray(input.stages) || input.stages.length === 0) {
    return failure("INVALID_INPUT", "stages must contain at least one stage", "stages");
  }

  const stageIds = new Set<string>();
  for (const [index, stage] of input.stages.entries()) {
    const path = `stages.${index}`;
    if (!stage || !nonEmptyString(stage.name)) {
      return failure("INVALID_INPUT", "stage name must be a non-empty string", `${path}.name`);
    }
    if (stage.id !== undefined && !nonEmptyString(stage.id)) {
      return failure("INVALID_INPUT", "stage id must be a non-empty string", `${path}.id`);
    }
    if (stage.id && stageIds.has(stage.id)) {
      return failure("DUPLICATE_STAGE_ID", `stage id "${stage.id}" is duplicated`, `${path}.id`);
    }
    if (stage.id) stageIds.add(stage.id);

    if (!Array.isArray(stage.approverIds) || stage.approverIds.length === 0) {
      return failure(
        "INVALID_INPUT",
        "approverIds must contain at least one approver",
        `${path}.approverIds`,
      );
    }

    const approvers = new Set<string>();
    for (const [approverIndex, approverId] of stage.approverIds.entries()) {
      if (!nonEmptyString(approverId)) {
        return failure(
          "INVALID_INPUT",
          "approver id must be a non-empty string",
          `${path}.approverIds.${approverIndex}`,
        );
      }
      if (approvers.has(approverId)) {
        return failure(
          "DUPLICATE_APPROVER",
          `approver "${approverId}" is duplicated within stage ${index}`,
          `${path}.approverIds.${approverIndex}`,
        );
      }
      approvers.add(approverId);
    }

    const threshold = stage.requiredApprovals ?? stage.approverIds.length;
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > stage.approverIds.length) {
      return failure(
        "INVALID_APPROVAL_THRESHOLD",
        "requiredApprovals must be an integer between 1 and the number of approvers",
        `${path}.requiredApprovals`,
      );
    }
  }
}

function defaultGenerateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `chain-${Date.now()}-${Math.random()}`;
}

/**
 * Creates a non-UI executor with replaceable clock, id generation, and storage.
 */
export function createApprovalChainBuilderService(
  dependencies: ApprovalChainBuilderDependencies = {},
) {
  const generateId = dependencies.generateId ?? defaultGenerateId;
  const now = dependencies.now ?? (() => new Date());

  async function execute(input: ApprovalChainBuilderInput): Promise<ApprovalChainBuilderResult> {
    try {
      const validationFailure = validateInput(input);
      if (validationFailure) return validationFailure;

      const stages: ApprovalStage[] = input.stages.map((stage, order) => ({
        id: stage.id ?? generateId(),
        name: stage.name.trim(),
        approverIds: stage.approverIds.map((id) => id.trim()),
        requiredApprovals: stage.requiredApprovals ?? stage.approverIds.length,
        order,
      }));

      const chain: ApprovalChain = {
        id: generateId(),
        subjectId: input.subjectId.trim(),
        subjectType: input.subjectType.trim(),
        name: input.name.trim(),
        createdBy: input.createdBy.trim(),
        createdAt: now().toISOString(),
        status: "draft",
        stages,
        ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
      };

      if (dependencies.repository) {
        try {
          await dependencies.repository.save(chain);
        } catch {
          return failure("PERSISTENCE_FAILED", "The approval chain could not be persisted");
        }
      }

      return { ok: true, data: chain };
    } catch {
      return failure("INTERNAL_ERROR", "Approval chain execution failed unexpectedly");
    }
  }

  return { execute };
}

/** Default backend-facing entry point. It builds without assuming a persistence backend. */
export const approvalChainBuilderService = createApprovalChainBuilderService();

export type ApprovalChainBuilderService = ReturnType<typeof createApprovalChainBuilderService>;
