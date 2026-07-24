export { createAccessService } from "./services/access.service";
export { useRoleBasedAccess } from "./hooks/use-role-based-access";
export { PolicyMatrix, AccessVerifier, AccessConsole } from "./components";
export type {
  VerifyAccessRequest,
  AccessCheckLog,
  AccessPolicy,
  LimitVerificationResult,
} from "./types";
