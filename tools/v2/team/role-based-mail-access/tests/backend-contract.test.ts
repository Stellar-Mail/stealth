import { describe, it, expect } from "vitest";
import {
  RoleBasedMailAccessBackendService,
  AccessBackendService,
} from "../services/accessBackendService";
import {
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
} from "../fixtures/backend-contract";

describe("RoleBasedMailAccessBackendService Non-UI Execution Contract", () => {
  const createService = (options?: any) =>
    new RoleBasedMailAccessBackendService(undefined, options);

  describe("Service Entry Point & Aliases", () => {
    it("exports RoleBasedMailAccessBackendService and AccessBackendService alias identically", () => {
      expect(RoleBasedMailAccessBackendService).toBe(AccessBackendService);
    });

    it("initializes cleanly and getPolicy returns default policy with success: true", async () => {
      const service = createService();
      const res = await service.getPolicy();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.policy.admin).toContain("read");
        expect(res.data.policy.manager).toContain("assign");
      }
    });
  });

  describe("updatePolicy contract", () => {
    it("successfully updates policy for valid role and accessLevels", async () => {
      const service = createService();
      const res = await service.updatePolicy(validUpdatePolicyInputFixture);

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.updatedRole).toBe(validUpdatePolicyInputFixture.role);
        expect(res.data.policy[validUpdatePolicyInputFixture.role]).toEqual(
          validUpdatePolicyInputFixture.accessLevels,
        );
      }
    });

    it("returns UNKNOWN_ROLE error when role is not in allowed roles", async () => {
      const service = createService();
      const res = await service.updatePolicy(invalidUpdatePolicyRoleFixture);

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNKNOWN_ROLE");
        expect(res.error.field).toBe("role");
      }
    });

    it("returns UNKNOWN_ACCESS_LEVEL error when access level is not recognised", async () => {
      const service = createService();
      const res = await service.updatePolicy(invalidUpdatePolicyLevelFixture);

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNKNOWN_ACCESS_LEVEL");
        expect(res.error.field).toBe("accessLevel");
      }
    });

    it("returns INVALID_INPUT when input is malformed", async () => {
      const service = createService();
      const res = await service.updatePolicy(null as any);

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("INVALID_INPUT");
      }
    });
  });

  describe("verifyAccess contract", () => {
    it("returns success: true with isAllowed: true for permitted access request", async () => {
      const service = createService();
      const res = await service.verifyAccess(validVerifyAccessInputFixture);

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.isAllowed).toBe(true);
        expect(res.data.role).toBe(validVerifyAccessInputFixture.role);
        expect(res.data.logId).toBeDefined();
      }
    });

    it("returns success: true with isAllowed: false when policy denies access", async () => {
      const service = createService();
      const res = await service.verifyAccess(validVerifyAccessDeniedFixture);

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.isAllowed).toBe(false);
        expect(res.data.role).toBe(validVerifyAccessDeniedFixture.role);
        expect(res.data.logId).toBeDefined();
      }
    });

    it("returns INVALID_INPUT error on malformed email address", async () => {
      const service = createService();
      const res = await service.verifyAccess(invalidInputEmptyEmailFixture);

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("INVALID_INPUT");
        expect(res.error.field).toBe("email");
      }
    });

    it("returns INVALID_INPUT error on path traversal in threadId", async () => {
      const service = createService();
      const res = await service.verifyAccess(invalidInputThreadIdPathTraversalFixture);

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("INVALID_INPUT");
        expect(res.error.field).toBe("threadId");
      }
    });

    it("returns UNKNOWN_ROLE error when role is not recognised", async () => {
      const service = createService();
      const res = await service.verifyAccess(unknownRoleInputFixture);

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNKNOWN_ROLE");
        expect(res.error.field).toBe("role");
      }
    });

    it("returns UNKNOWN_ACCESS_LEVEL error when accessLevel is not recognised", async () => {
      const service = createService();
      const res = await service.verifyAccess(unknownAccessLevelInputFixture);

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("UNKNOWN_ACCESS_LEVEL");
        expect(res.error.field).toBe("accessLevel");
      }
    });
  });

  describe("batchVerifyAccess contract", () => {
    it("evaluates a batch of requests and reports summary counts", async () => {
      const service = createService();
      const res = await service.batchVerifyAccess(validBatchVerifyInputFixture);

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.total).toBe(3);
        expect(res.data.allowedCount).toBe(2);
        expect(res.data.deniedCount).toBe(1);
        expect(res.data.errorCount).toBe(0);
        expect(res.data.results).toHaveLength(3);
      }
    });

    it("returns INVALID_INPUT if requests is not an array", async () => {
      const service = createService();
      const res = await service.batchVerifyAccess({
        requests: "invalid" as any,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("INVALID_INPUT");
      }
    });
  });

  describe("getLogs and clearLogs contracts", () => {
    it("returns filtered logs and supports clearing them", async () => {
      const service = createService();
      await service.verifyAccess(validVerifyAccessInputFixture);
      await service.verifyAccess(validVerifyAccessDeniedFixture);

      const logsRes = await service.getLogs({ role: "manager" });
      expect(logsRes.success).toBe(true);
      if (logsRes.success) {
        expect(logsRes.data.total).toBe(1);
        expect(logsRes.data.logs[0].request.role).toBe("manager");
      }

      const clearRes = await service.clearLogs();
      expect(clearRes.success).toBe(true);
      if (clearRes.success) {
        expect(clearRes.data.clearedCount).toBeGreaterThanOrEqual(2);
      }

      const emptyLogsRes = await service.getLogs();
      expect(emptyLogsRes.success).toBe(true);
      if (emptyLogsRes.success) {
        expect(emptyLogsRes.data.total).toBe(0);
      }
    });
  });

  describe("checkLimits contract", () => {
    it("returns success: true when limits are respected", async () => {
      const service = createService();
      const res = await service.checkLimits(validCheckLimitsInputFixture);

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.teamSizeValid).toBe(true);
        expect(res.data.attachmentCountValid).toBe(true);
      }
    });

    it("returns LIMIT_EXCEEDED error when teamSize exceeds safe boundary", async () => {
      const service = createService();
      const res = await service.checkLimits(limitExceededTeamSizeFixture);

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("LIMIT_EXCEEDED");
        expect(res.error.message).toContain("exceeds safe limit");
      }
    });

    it("returns LIMIT_EXCEEDED error when attachmentCount exceeds safe boundary", async () => {
      const service = createService();
      const res = await service.checkLimits(limitExceededAttachmentCountFixture);

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("LIMIT_EXCEEDED");
        expect(res.error.message).toContain("exceeds safe limit");
      }
    });

    it("returns INVALID_INPUT on negative numbers", async () => {
      const service = createService();
      const res = await service.checkLimits({
        teamSize: -1,
        attachmentCount: 10,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("INVALID_INPUT");
      }
    });
  });

  describe("INVALID_STATE error code", () => {
    it("rejects operations when service is initialized in an error state", async () => {
      const service = createService({
        status: "error",
        errorMessage: "Backend store unrecoverable",
      });
      const res = await service.getPolicy();

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("INVALID_STATE");
        expect(res.error.message).toContain("Backend store unrecoverable");
      }
    });
  });
});
