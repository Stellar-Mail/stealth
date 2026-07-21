/**
 * Presentation-independent execution contract for Approval Chain Builder.
 *
 * Consumers should branch on `ok` and `error.code`, never on error messages.
 */

export type ApprovalChainErrorCode =
  | "INVALID_INPUT"
  | "DUPLICATE_STAGE_ID"
  | "DUPLICATE_APPROVER"
  | "INVALID_APPROVAL_THRESHOLD"
  | "PERSISTENCE_FAILED"
  | "INTERNAL_ERROR";

export interface ApprovalStageInput {
  /** Optional caller-owned id. A generated id is used when omitted. */
  id?: string;
  /** Human-readable stage name, such as "Finance review". */
  name: string;
  /** Identities eligible to approve this stage. */
  approverIds: string[];
  /** Approvals required to complete the stage. Defaults to all approvers. */
  requiredApprovals?: number;
}

export interface ApprovalChainBuilderInput {
  /** Id of the business object that will use the chain. */
  subjectId: string;
  /** Stable subject category, for example "invoice" or "purchase-order". */
  subjectType: string;
  /** Name used to identify the chain outside presentation code. */
  name: string;
  /** Identity responsible for creating the chain. */
  createdBy: string;
  /** Ordered stages. A chain must contain at least one stage. */
  stages: ApprovalStageInput[];
  /** Optional opaque correlation id propagated to the result. */
  correlationId?: string;
}

export interface ApprovalStage {
  id: string;
  name: string;
  approverIds: string[];
  requiredApprovals: number;
  /** Zero-based position in sequential execution order. */
  order: number;
}

export interface ApprovalChain {
  id: string;
  subjectId: string;
  subjectType: string;
  name: string;
  createdBy: string;
  createdAt: string;
  status: "draft";
  stages: ApprovalStage[];
  correlationId?: string;
}

export interface ApprovalChainError {
  code: ApprovalChainErrorCode;
  message: string;
  /** Dot-path to the invalid field when the error is input-specific. */
  field?: string;
}

export type ApprovalChainBuilderResult =
  | { ok: true; data: ApprovalChain }
  | { ok: false; error: ApprovalChainError };

export type ExecuteApprovalChainBuilder = (
  input: ApprovalChainBuilderInput,
) => Promise<ApprovalChainBuilderResult>;
