import type {
  DepartmentLabels,
  DepartmentLabelsInput,
  DepartmentLabelsResult,
  DepartmentLabelsErrorCode,
  DepartmentLabel,
} from "../types/contract";

/** Optional persistence boundary. Transport and storage details stay outside this tool. */
export interface DepartmentLabelsRepository {
  save(labels: DepartmentLabels): Promise<void>;
}

export interface DepartmentLabelsDependencies {
  repository?: DepartmentLabelsRepository;
  generateId?: () => string;
  now?: () => Date;
}

function failure(
  code: DepartmentLabelsErrorCode,
  message: string,
  field?: string,
): DepartmentLabelsResult {
  return { ok: false, error: { code, message, ...(field ? { field } : {}) } };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function validateInput(input: DepartmentLabelsInput): DepartmentLabelsResult | undefined {
  if (!nonEmptyString(input?.createdBy)) {
    return failure("INVALID_INPUT", "createdBy must be a non-empty string", "createdBy");
  }

  if (!Array.isArray(input.labels) || input.labels.length === 0) {
    return failure("INVALID_INPUT", "labels must contain at least one label", "labels");
  }

  const labelIds = new Set<string>();
  const departmentCodes = new Set<string>();

  for (const [index, label] of input.labels.entries()) {
    const path = `labels.${index}`;
    if (!label || !nonEmptyString(label.name)) {
      return failure("INVALID_INPUT", "label name must be a non-empty string", `${path}.name`);
    }
    if (!nonEmptyString(label.departmentCode)) {
      return failure(
        "INVALID_INPUT",
        "departmentCode must be a non-empty string",
        `${path}.departmentCode`,
      );
    }
    if (label.id !== undefined && !nonEmptyString(label.id)) {
      return failure("INVALID_INPUT", "label id must be a non-empty string", `${path}.id`);
    }
    if (label.id && labelIds.has(label.id)) {
      return failure("DUPLICATE_LABEL_ID", `label id "${label.id}" is duplicated`, `${path}.id`);
    }
    if (label.id) labelIds.add(label.id);

    if (departmentCodes.has(label.departmentCode)) {
      return failure(
        "DUPLICATE_DEPARTMENT",
        `departmentCode "${label.departmentCode}" is duplicated`,
        `${path}.departmentCode`,
      );
    }
    departmentCodes.add(label.departmentCode);

    if (label.color !== undefined && !isValidHexColor(label.color)) {
      return failure(
        "INVALID_COLOR_FORMAT",
        "color must be a valid hex color code (e.g., #FF5733)",
        `${path}.color`,
      );
    }

    if (label.description !== undefined && typeof label.description !== "string") {
      return failure("INVALID_INPUT", "description must be a string", `${path}.description`);
    }
  }
}

function defaultGenerateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `labels-${Date.now()}-${Math.random()}`;
}

function defaultColor(): string {
  return "#3B82F6"; // Default blue color
}

/**
 * Creates a non-UI executor with replaceable clock, id generation, and storage.
 */
export function createDepartmentLabelsService(
  dependencies: DepartmentLabelsDependencies = {},
) {
  const generateId = dependencies.generateId ?? defaultGenerateId;
  const now = dependencies.now ?? (() => new Date());

  async function execute(input: DepartmentLabelsInput): Promise<DepartmentLabelsResult> {
    try {
      const validationFailure = validateInput(input);
      if (validationFailure) return validationFailure;

      const labels: DepartmentLabel[] = input.labels.map((label, order) => ({
        id: label.id ?? generateId(),
        name: label.name.trim(),
        departmentCode: label.departmentCode.trim(),
        color: label.color ?? defaultColor(),
        description: label.description?.trim(),
        order,
      }));

      const departmentLabels: DepartmentLabels = {
        id: generateId(),
        createdBy: input.createdBy.trim(),
        createdAt: now().toISOString(),
        labels,
        ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
      };

      if (dependencies.repository) {
        try {
          await dependencies.repository.save(departmentLabels);
        } catch {
          return failure("PERSISTENCE_FAILED", "The department labels could not be persisted");
        }
      }

      return { ok: true, data: departmentLabels };
    } catch {
      return failure("INTERNAL_ERROR", "Department labels execution failed unexpectedly");
    }
  }

  return { execute };
}

/** Default backend-facing entry point. It builds without assuming a persistence backend. */
export const departmentLabelsService = createDepartmentLabelsService();

export type DepartmentLabelsService = ReturnType<typeof createDepartmentLabelsService>;
