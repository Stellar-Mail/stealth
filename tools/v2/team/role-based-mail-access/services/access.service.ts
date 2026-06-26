import {
  sanitizeRole,
  validateAccessRequest,
  checkAccess,
  guardTeamSize,
  guardAttachmentCount,
  LIMITS,
} from "../guards/access-guards.mjs";
import { VerifyAccessRequest, AccessCheckLog, AccessPolicy } from "../types";

const DEFAULT_POLICY: AccessPolicy = {
  admin: ["read", "write", "assign", "delete", "manage"],
  manager: ["read", "write", "assign"],
  agent: ["read", "write"],
  viewer: ["read"],
  guest: [],
};

export function createAccessService(initialPolicy: AccessPolicy = DEFAULT_POLICY) {
  const policy = JSON.parse(JSON.stringify(initialPolicy)) as AccessPolicy;
  let logs: AccessCheckLog[] = [];
  let logCounter = 0;

  function getPolicy(): AccessPolicy {
    return policy;
  }

  function updatePolicy(role: string, accessLevels: string[]) {
    // Validate role is known
    const cleanRole = sanitizeRole(role);
    if (!cleanRole || !LIMITS.ALLOWED_ROLES.includes(cleanRole)) {
      throw new Error(`Invalid role: ${role}`);
    }

    // Validate access levels are known
    for (const level of accessLevels) {
      if (!LIMITS.ALLOWED_ACCESS_LEVELS.includes(level)) {
        throw new Error(`Invalid access level: ${level}`);
      }
    }

    policy[cleanRole] = [...accessLevels];
  }

  function getLogs(): AccessCheckLog[] {
    return logs;
  }

  function clearLogs() {
    logs = [];
  }

  interface CheckResult {
    isAllowed: boolean;
    error?: string;
    field?: string;
  }

  function checkRequest(req: VerifyAccessRequest): CheckResult {
    try {
      // 1. Sanitize role
      const sanitizedRole = sanitizeRole(req.role);
      const reqToValidate = {
        ...req,
        role: sanitizedRole ?? "",
      };

      // 2. Run schema validators
      validateAccessRequest(reqToValidate);

      // 3. Evaluate access policy
      const isAllowed = checkAccess(reqToValidate.role, reqToValidate.accessLevel, policy);

      logCounter++;
      const newLog: AccessCheckLog = {
        id: `log-${String(logCounter).padStart(3, "0")}`,
        request: { ...reqToValidate },
        isAllowed,
        timestamp: new Date().toISOString(),
      };
      logs = [newLog, ...logs];

      return { isAllowed };
    } catch (err: unknown) {
      const error = err as { message?: string; field?: string };
      logCounter++;
      const newLog: AccessCheckLog = {
        id: `log-${String(logCounter).padStart(3, "0")}`,
        request: { ...req },
        isAllowed: false,
        error: error.message ?? "Unknown error",
        timestamp: new Date().toISOString(),
      };
      logs = [newLog, ...logs];

      return {
        isAllowed: false,
        error: error.message ?? "Unknown error",
        field: error.field,
      };
    }
  }

  interface LimitResult {
    teamSizeValid: boolean;
    teamSizeError?: string;
    attachmentCountValid: boolean;
    attachmentCountError?: string;
  }

  function checkLimits(teamSize: number, attachmentCount: number): LimitResult {
    const result: LimitResult = {
      teamSizeValid: true,
      attachmentCountValid: true,
    };

    try {
      const mockTeam = Array(teamSize).fill({});
      guardTeamSize(mockTeam);
    } catch (err: unknown) {
      const error = err as Error;
      result.teamSizeValid = false;
      result.teamSizeError = error.message;
    }

    try {
      const mockAttachments = Array(attachmentCount).fill({});
      guardAttachmentCount(mockAttachments);
    } catch (err: unknown) {
      const error = err as Error;
      result.attachmentCountValid = false;
      result.attachmentCountError = error.message;
    }

    return result;
  }

  return {
    getPolicy,
    updatePolicy,
    getLogs,
    clearLogs,
    checkRequest,
    checkLimits,
  };
}
export default createAccessService;
