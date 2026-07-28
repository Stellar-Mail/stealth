/**
 * Presentation-independent execution contract for Department Labels.
 *
 * Consumers should branch on `ok` and `error.code`, never on error messages.
 */

export type DepartmentLabelsErrorCode =
  | "INVALID_INPUT"
  | "DUPLICATE_LABEL_ID"
  | "DUPLICATE_DEPARTMENT"
  | "INVALID_COLOR_FORMAT"
  | "PERSISTENCE_FAILED"
  | "INTERNAL_ERROR";

export interface DepartmentLabelInput {
  /** Optional caller-owned id. A generated id is used when omitted. */
  id?: string;
  /** Human-readable label name, such as "Finance" or "Engineering". */
  name: string;
  /** Department code or identifier, such as "FIN" or "ENG". */
  departmentCode: string;
  /** Hex color code for visual identification, e.g., "#FF5733". */
  color?: string;
  /** Optional description of the department. */
  description?: string;
}

export interface DepartmentLabelsInput {
  /** Identity responsible for creating the labels. */
  createdBy: string;
  /** Ordered department labels. At least one label is required. */
  labels: DepartmentLabelInput[];
  /** Optional opaque correlation id propagated to the result. */
  correlationId?: string;
}

export interface DepartmentLabel {
  id: string;
  name: string;
  departmentCode: string;
  color: string;
  description?: string;
  /** Zero-based position in sequential order. */
  order: number;
}

export interface DepartmentLabels {
  id: string;
  createdBy: string;
  createdAt: string;
  labels: DepartmentLabel[];
  correlationId?: string;
}

export interface DepartmentLabelsError {
  code: DepartmentLabelsErrorCode;
  message: string;
  /** Dot-path to the invalid field when the error is input-specific. */
  field?: string;
}

export type DepartmentLabelsResult =
  | { ok: true; data: DepartmentLabels }
  | { ok: false; error: DepartmentLabelsError };

export type ExecuteDepartmentLabels = (
  input: DepartmentLabelsInput,
) => Promise<DepartmentLabelsResult>;
