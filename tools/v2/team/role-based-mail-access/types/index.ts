export interface VerifyAccessRequest {
  requesterEmail: string;
  role: string;
  accessLevel: string;
  threadId: string;
}

export interface AccessCheckLog {
  id: string;
  request: VerifyAccessRequest;
  isAllowed: boolean;
  error?: string;
  timestamp: string;
}

export interface AccessPolicy {
  [role: string]: string[];
}

export interface LimitVerificationResult {
  teamSizeValid: boolean;
  teamSizeError?: string;
  attachmentCountValid: boolean;
  attachmentCountError?: string;
}

// ---------------------------------------------------------------------------
// Non-UI Backend Execution Contract Types (#1362)
// ---------------------------------------------------------------------------

export type AccessErrorCode =
  | "INVALID_INPUT"
  | "UNKNOWN_ROLE"
  | "UNKNOWN_ACCESS_LEVEL"
  | "LIMIT_EXCEEDED"
  | "POLICY_UPDATE_ERROR"
  | "INVALID_STATE"
  | "UNHANDLED_ERROR";

export interface AccessError {
  code: AccessErrorCode;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export type AccessResult<T> = { success: true; data: T } | { success: false; error: AccessError };

export interface GetPolicyOutput {
  policy: AccessPolicy;
}

export interface UpdatePolicyInput {
  role: string;
  accessLevels: string[];
}

export interface UpdatePolicyOutput {
  policy: AccessPolicy;
  updatedRole: string;
  accessLevels: string[];
}

export type VerifyAccessInput = VerifyAccessRequest;

export interface VerifyAccessOutput {
  isAllowed: boolean;
  role: string;
  accessLevel: string;
  threadId: string;
  requesterEmail: string;
  logId?: string;
  error?: string;
}

export interface BatchVerifyAccessInput {
  requests: VerifyAccessRequest[];
}

export interface BatchVerifyAccessItemResult {
  request: VerifyAccessRequest;
  result: AccessResult<VerifyAccessOutput>;
}

export interface BatchVerifyAccessOutput {
  results: BatchVerifyAccessItemResult[];
  total: number;
  allowedCount: number;
  deniedCount: number;
  errorCount: number;
}

export interface GetLogsInput {
  limit?: number;
  role?: string;
  isAllowed?: boolean;
}

export interface GetLogsOutput {
  logs: AccessCheckLog[];
  total: number;
}

export interface ClearLogsOutput {
  clearedCount: number;
}

export interface CheckLimitsInput {
  teamSize: number;
  attachmentCount: number;
}

export interface CheckLimitsOutput {
  teamSizeValid: boolean;
  teamSizeError?: string;
  attachmentCountValid: boolean;
  attachmentCountError?: string;
}

export interface IRoleBasedMailAccessBackendService {
  getPolicy(): Promise<AccessResult<GetPolicyOutput>>;
  updatePolicy(input: UpdatePolicyInput): Promise<AccessResult<UpdatePolicyOutput>>;
  verifyAccess(input: VerifyAccessInput): Promise<AccessResult<VerifyAccessOutput>>;
  batchVerifyAccess(input: BatchVerifyAccessInput): Promise<AccessResult<BatchVerifyAccessOutput>>;
  getLogs(input?: GetLogsInput): Promise<AccessResult<GetLogsOutput>>;
  clearLogs(): Promise<AccessResult<ClearLogsOutput>>;
  checkLimits(input: CheckLimitsInput): Promise<AccessResult<CheckLimitsOutput>>;
}

export type IAccessBackendService = IRoleBasedMailAccessBackendService;
