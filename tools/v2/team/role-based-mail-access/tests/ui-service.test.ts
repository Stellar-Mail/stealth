import { describe, it, expect, beforeEach } from "vitest";
import { createAccessService } from "../services/access.service";
import { VerifyAccessRequest } from "../types";

describe("Role-Based Mail Access UI Service Tests", () => {
  let service: ReturnType<typeof createAccessService>;

  beforeEach(() => {
    service = createAccessService();
  });

  describe("Service Initialization", () => {
    it("should load the default access policy correctly", () => {
      const policy = service.getPolicy();
      expect(policy.admin).toEqual(["read", "write", "assign", "delete", "manage"]);
      expect(policy.guest).toEqual([]);
    });

    it("should start with an empty log array", () => {
      expect(service.getLogs().length).toBe(0);
    });
  });

  describe("Access Policy Mutations", () => {
    it("should allow updating policies for a valid role", () => {
      service.updatePolicy("manager", ["read", "write", "manage"]);
      expect(service.getPolicy().manager).toEqual(["read", "write", "manage"]);
    });

    it("should throw an error for unrecognized roles", () => {
      expect(() => service.updatePolicy("unknown-role", ["read"])).toThrow(/Invalid role/);
    });

    it("should throw an error for unrecognized access levels", () => {
      expect(() => service.updatePolicy("agent", ["read", "hack-db"])).toThrow(
        /Invalid access level/,
      );
    });
  });

  describe("Access Requests Checking", () => {
    it("should authorize an access request that aligns with policy", () => {
      const req: VerifyAccessRequest = {
        requesterEmail: "test@example.test",
        role: "manager",
        accessLevel: "assign",
        threadId: "thread-001",
      };

      const res = service.checkRequest(req);
      expect(res.isAllowed).toBe(true);
      expect(res.error).toBeUndefined();

      // Log verified
      expect(service.getLogs().length).toBe(1);
      expect(service.getLogs()[0].isAllowed).toBe(true);
    });

    it("should deny an access request that violates policy", () => {
      const req: VerifyAccessRequest = {
        requesterEmail: "test@example.test",
        role: "guest",
        accessLevel: "read",
        threadId: "thread-001",
      };

      const res = service.checkRequest(req);
      expect(res.isAllowed).toBe(false);
      expect(res.error).toBeUndefined();

      expect(service.getLogs().length).toBe(1);
      expect(service.getLogs()[0].isAllowed).toBe(false);
    });

    it("should catch input validation failures in email addresses", () => {
      const req: VerifyAccessRequest = {
        requesterEmail: "bad-email-no-at",
        role: "agent",
        accessLevel: "read",
        threadId: "thread-001",
      };

      const res = service.checkRequest(req);
      expect(res.isAllowed).toBe(false);
      expect(res.error).toContain("email is malformed");
      expect(res.field).toBe("email");

      expect(service.getLogs().length).toBe(1);
      expect(service.getLogs()[0].isAllowed).toBe(false);
      expect(service.getLogs()[0].error).toContain("email is malformed");
    });

    it("should catch injection patterns in threadIds", () => {
      const req: VerifyAccessRequest = {
        requesterEmail: "user@example.test",
        role: "agent",
        accessLevel: "read",
        threadId: "../../../path-traversal",
      };

      const res = service.checkRequest(req);
      expect(res.isAllowed).toBe(false);
      expect(res.field).toBe("threadId");

      expect(service.getLogs().length).toBe(1);
    });
  });

  describe("Boundary Limit Guard Verifications", () => {
    it("should pass for team size and attachment count under the limit thresholds", () => {
      const res = service.checkLimits(499, 99);
      expect(res.teamSizeValid).toBe(true);
      expect(res.attachmentCountValid).toBe(true);
    });

    it("should report errors when team size exceeds the limit", () => {
      const res = service.checkLimits(501, 5);
      expect(res.teamSizeValid).toBe(false);
      expect(res.teamSizeError).toContain("exceeds safe limit");
      expect(res.attachmentCountValid).toBe(true);
    });

    it("should report errors when attachment count exceeds the limit", () => {
      const res = service.checkLimits(10, 101);
      expect(res.teamSizeValid).toBe(true);
      expect(res.attachmentCountValid).toBe(false);
      expect(res.attachmentCountError).toContain("exceeds safe limit");
    });
  });
});
