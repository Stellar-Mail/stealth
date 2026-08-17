export { createAccessService } from "./services/access.service";
export {
  RoleBasedMailAccessBackendService,
  AccessBackendService,
} from "./services/accessBackendService";
export { useRoleBasedAccess } from "./hooks/use-role-based-access";
export { PolicyMatrix, AccessVerifier, AccessConsole } from "./components";

export type {
  VerifyAccessRequest,
  AccessCheckLog,
  AccessPolicy,
  LimitVerificationResult,
  AccessErrorCode,
  AccessError,
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
  IRoleBasedMailAccessBackendService,
  IAccessBackendService,
} from "./types";

export {
  validVerifyAccessInputFixture,
  validVerifyAccessDeniedFixture,
  validUpdatePolicyInputFixture,
  validBatchVerifyInputFixture,
  validCheckLimitsInputFixture,
  invalidInputEmptyEmailFixture,
  invalidInputThreadIdPathTraversalFixture,
  unknownRoleInputFixture,
  unknownAccessLevelInputFixture,
  limitExceededTeamSizeFixture,
  limitExceededAttachmentCountFixture,
  invalidUpdatePolicyRoleFixture,
  invalidUpdatePolicyLevelFixture,
} from "./fixtures/backend-contract";
