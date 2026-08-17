import { beforeEach, describe, expect, it } from "vitest";

import { createAccessService } from "../services/access.service";

describe("Role-Based Mail Access service behavior", () => {
  let service: ReturnType<typeof createAccessService>;

  beforeEach(() => {
    service = createAccessService();
  });

  it("sanitizes role input before policy lookup and stores the cleaned request", () => {
    const result = service.checkRequest({
      requesterEmail: "alice@example.test",
      role: "  Manager  ",
      accessLevel: "assign",
      threadId: "thread-support-001",
    });

    expect(result.isAllowed).toBe(true);
    expect(service.getLogs()).toHaveLength(1);
    expect(service.getLogs()[0].request.role).toBe("manager");
  });

  it("keeps audit entries newest-first", () => {
    service.checkRequest({
      requesterEmail: "alice@example.test",
      role: "manager",
      accessLevel: "assign",
      threadId: "thread-support-001",
    });
    service.checkRequest({
      requesterEmail: "bob@example.test",
      role: "agent",
      accessLevel: "read",
      threadId: "thread-billing-042",
    });

    expect(service.getLogs().map((entry) => entry.request.threadId)).toEqual([
      "thread-billing-042",
      "thread-support-001",
    ]);
  });

  it("clears only the log history", () => {
    service.checkRequest({
      requesterEmail: "alice@example.test",
      role: "manager",
      accessLevel: "assign",
      threadId: "thread-support-001",
    });

    service.clearLogs();

    expect(service.getLogs()).toEqual([]);
    expect(service.getPolicy().manager).toEqual(["read", "write", "assign"]);
  });

  it("clones the initial policy so external fixture edits do not leak into the service", () => {
    const initialPolicy = {
      admin: ["read", "write", "assign", "delete", "manage"],
      manager: ["read", "write", "assign"],
      agent: ["read", "write"],
      viewer: ["read"],
      guest: [],
    };

    const clonedService = createAccessService(initialPolicy);
    initialPolicy.manager.push("manage");

    expect(clonedService.getPolicy().manager).toEqual(["read", "write", "assign"]);
  });

  it("accepts limits exactly at the configured thresholds", () => {
    expect(service.checkLimits(500, 100)).toEqual({
      teamSizeValid: true,
      attachmentCountValid: true,
    });
  });
});
