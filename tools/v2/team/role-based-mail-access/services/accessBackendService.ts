import type {
  IRoleBasedMailAccessBackendService,
  AccessPolicy,
  AccessResult,
  GetPolicyOutput,
  UpdatePolicyInput,
  UpdatePolicyOutput,
  VerifyAccessInput,
  VerifyAccessOutput,
  BatchVerifyAccessInput,
  BatchVerifyAccessItemResult,
  BatchVerifyAccessOutput,
  GetLogsInput,
  GetLogsOutput,
  ClearLogsOutput,
  CheckLimitsInput,
  CheckLimitsOutput,
  AccessErrorCode,
} from "../types";
import { createAccessService } from "./access.service";
import { LIMITS, sanitizeRole } from "../guards/access-guards.mjs";

export type BackendServiceStatus = "success" | "error" | "loading";

export interface BackendServiceOptions {
  status?: BackendServiceStatus;
  errorMessage?: string;
}

/**
 * Non-UI service entry point for Role-Based Mail Access (#1362).
 * Operates independently of presentation concerns, returning strictly typed
 * input/output contracts and structured error codes.
 */
export class RoleBasedMailAccessBackendService implements IRoleBasedMailAccessBackendService {
  private accessService: ReturnType<typeof createAccessService>;
  private status: BackendServiceStatus;
  private errorMessage?: string;

  constructor(initialPolicy?: AccessPolicy, options?: BackendServiceOptions) {
    this.accessService = createAccessService(initialPolicy);
    this.status = options?.status ?? "success";
    this.errorMessage = options?.errorMessage;
  }

  private checkState(): AccessResult<never> | null {
    if (this.status !== "success") {
      return {
        success: false,
        error: {
          code: "INVALID_STATE",
          message:
            this.errorMessage || `Cannot execute operation in current state: ${this.status}.`,
        },
      };
    }
    return null;
  }

  /**
   * Retrieves the current access policy.
   */
  async getPolicy(): Promise<AccessResult<GetPolicyOutput>> {
    const stateErr = this.checkState();
    if (stateErr) return stateErr;

    try {
      const policy = this.accessService.getPolicy();
      return {
        success: true,
        data: { policy: JSON.parse(JSON.stringify(policy)) },
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        error: {
          code: "UNHANDLED_ERROR",
          message: error.message || "An unexpected error occurred while fetching policy.",
        },
      };
    }
  }

  /**
   * Updates the allowed access levels for a role in the policy.
   */
  async updatePolicy(input: UpdatePolicyInput): Promise<AccessResult<UpdatePolicyOutput>> {
    const stateErr = this.checkState();
    if (stateErr) return stateErr;

    if (!input || typeof input.role !== "string" || !Array.isArray(input.accessLevels)) {
      return {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "role must be a string and accessLevels must be an array of strings.",
        },
      };
    }

    try {
      this.accessService.updatePolicy(input.role, input.accessLevels);
      const policy = this.accessService.getPolicy();
      const cleanRole = sanitizeRole(input.role) || input.role;

      return {
        success: true,
        data: {
          policy: JSON.parse(JSON.stringify(policy)),
          updatedRole: cleanRole,
          accessLevels: [...input.accessLevels],
        },
      };
    } catch (err: unknown) {
      const error = err as { message?: string };
      const message = error.message || "Failed to update policy.";

      let code: AccessErrorCode = "POLICY_UPDATE_ERROR";
      let field: string | undefined;

      if (message.includes("Invalid role") || message.includes("not a recognised role")) {
        code = "UNKNOWN_ROLE";
        field = "role";
      } else if (
        message.includes("Invalid access level") ||
        message.includes("not a recognised access level")
      ) {
        code = "UNKNOWN_ACCESS_LEVEL";
        field = "accessLevel";
      }

      return {
        success: false,
        error: {
          code,
          message,
          field,
        },
      };
    }
  }

  /**
   * Verifies an access request against the policy and boundary validators.
   */
  async verifyAccess(input: VerifyAccessInput): Promise<AccessResult<VerifyAccessOutput>> {
    const stateErr = this.checkState();
    if (stateErr) return stateErr;

    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "access request must be a plain object",
          field: "request",
        },
      };
    }

    try {
      const res = this.accessService.checkRequest(input);

      if (res.error) {
        let code: AccessErrorCode = "INVALID_INPUT";
        if (
          res.field === "role" &&
          (res.error.includes("not a recognised role") || res.error.includes("Invalid role"))
        ) {
          code = "UNKNOWN_ROLE";
        } else if (
          res.field === "accessLevel" &&
          (res.error.includes("not a recognised access level") ||
            res.error.includes("Invalid access level"))
        ) {
          code = "UNKNOWN_ACCESS_LEVEL";
        }

        return {
          success: false,
          error: {
            code,
            message: res.error,
            field: res.field,
          },
        };
      }

      const logs = this.accessService.getLogs();
      const latestLog = logs[0];

      return {
        success: true,
        data: {
          isAllowed: res.isAllowed,
          role: input.role,
          accessLevel: input.accessLevel,
          threadId: input.threadId,
          requesterEmail: input.requesterEmail,
          logId: latestLog?.id,
          error: latestLog?.error,
        },
      };
    } catch (err: unknown) {
      const error = err as { message?: string; field?: string };
      return {
        success: false,
        error: {
          code: "UNHANDLED_ERROR",
          message: error.message || "An unexpected error occurred during verification.",
          field: error.field,
        },
      };
    }
  }

  /**
   * Verifies a batch of access requests in sequence.
   */
  async batchVerifyAccess(
    input: BatchVerifyAccessInput,
  ): Promise<AccessResult<BatchVerifyAccessOutput>> {
    const stateErr = this.checkState();
    if (stateErr) return stateErr;

    if (!input || !Array.isArray(input.requests)) {
      return {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "requests must be an array of VerifyAccessRequest objects.",
          field: "requests",
        },
      };
    }

    const results: BatchVerifyAccessItemResult[] = [];
    let allowedCount = 0;
    let deniedCount = 0;
    let errorCount = 0;

    for (const req of input.requests) {
      const res = await this.verifyAccess(req);
      results.push({ request: req, result: res });
      if (res.success) {
        if (res.data.isAllowed) {
          allowedCount++;
        } else {
          deniedCount++;
        }
      } else {
        errorCount++;
      }
    }

    return {
      success: true,
      data: {
        results,
        total: input.requests.length,
        allowedCount,
        deniedCount,
        errorCount,
      },
    };
  }

  /**
   * Retrieves audit logs of access checks.
   */
  async getLogs(input?: GetLogsInput): Promise<AccessResult<GetLogsOutput>> {
    const stateErr = this.checkState();
    if (stateErr) return stateErr;

    try {
      let logs = [...this.accessService.getLogs()];

      if (input?.role) {
        const filterRole = input.role.toLowerCase();
        logs = logs.filter((log) => log.request.role.toLowerCase() === filterRole);
      }

      if (typeof input?.isAllowed === "boolean") {
        logs = logs.filter((log) => log.isAllowed === input.isAllowed);
      }

      if (typeof input?.limit === "number" && input.limit > 0) {
        logs = logs.slice(0, input.limit);
      }

      return {
        success: true,
        data: {
          logs,
          total: logs.length,
        },
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        error: {
          code: "UNHANDLED_ERROR",
          message: error.message || "Failed to retrieve logs.",
        },
      };
    }
  }

  /**
   * Clears all audit logs.
   */
  async clearLogs(): Promise<AccessResult<ClearLogsOutput>> {
    const stateErr = this.checkState();
    if (stateErr) return stateErr;

    try {
      const count = this.accessService.getLogs().length;
      this.accessService.clearLogs();
      return {
        success: true,
        data: { clearedCount: count },
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        error: {
          code: "UNHANDLED_ERROR",
          message: error.message || "Failed to clear logs.",
        },
      };
    }
  }

  /**
   * Verifies team size and attachment count against boundary limits.
   */
  async checkLimits(input: CheckLimitsInput): Promise<AccessResult<CheckLimitsOutput>> {
    const stateErr = this.checkState();
    if (stateErr) return stateErr;

    if (
      !input ||
      typeof input.teamSize !== "number" ||
      typeof input.attachmentCount !== "number" ||
      input.teamSize < 0 ||
      input.attachmentCount < 0 ||
      !Number.isInteger(input.teamSize) ||
      !Number.isInteger(input.attachmentCount)
    ) {
      return {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "teamSize and attachmentCount must be non-negative integers.",
        },
      };
    }

    const res = this.accessService.checkLimits(input.teamSize, input.attachmentCount);
    if (!res.teamSizeValid || !res.attachmentCountValid) {
      return {
        success: false,
        error: {
          code: "LIMIT_EXCEEDED",
          message: res.teamSizeError || res.attachmentCountError || "Safe boundary limit exceeded.",
          details: { ...res },
        },
      };
    }

    return {
      success: true,
      data: {
        teamSizeValid: true,
        attachmentCountValid: true,
      },
    };
  }
}

export { RoleBasedMailAccessBackendService as AccessBackendService };
