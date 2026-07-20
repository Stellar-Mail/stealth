import { describe, expect, it, vi } from "vitest";

import { MemoryApiRepository } from "./memory-repository";
import { setMailboxPolicy, setSenderRule } from "./policy-service";
import type { PolicyAuditEvent } from "./audit-service";

describe("Policy Audit Logging", () => {
  const owner = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFXYAUIAGRZBG6LNO4A" + "AA".substring(0, 2);
  const sender = "GCS5A4Z5J6Q6BXLFMNDLFJUNPU2HY3ZMFXYAUIAGRZBG6LNO4AAAA";
  const actor = owner;

  const mockRequest = new Request("http://localhost/api/v1/policies", {
    headers: {
      "x-request-id": "req-test-12345",
      "x-stealth-address": actor,
    },
  });

  const ctx = { request: mockRequest, actor };

  it("emits success audit log for mailbox policy updates", async () => {
    const repo = new MemoryApiRepository();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const newPolicy = {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    };

    await setMailboxPolicy(repo, owner, newPolicy, ctx);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const loggedJson = consoleSpy.mock.calls[0][0];
    const event: PolicyAuditEvent = JSON.parse(loggedJson);

    expect(event.requestId).toBe("req-test-12345");
    expect(event.actor).toBe(actor);
    expect(event.owner).toBe(owner);
    expect(event.action).toBe("update_mailbox_policy");
    expect(event.target.type).toBe("mailbox_policy");
    expect(event.status).toBe("success");
    expect(event.changes.after).toEqual(newPolicy);

    consoleSpy.mockRestore();
  });

  it("emits success audit log for sender rule updates", async () => {
    const repo = new MemoryApiRepository();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await setSenderRule(repo, owner, sender, "allow", ctx);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const event: PolicyAuditEvent = JSON.parse(consoleSpy.mock.calls[0][0]);

    expect(event.action).toBe("update_sender_rule");
    expect(event.target.type).toBe("sender_rule");
    expect(event.target.sender).toBe(sender);
    expect(event.changes.before).toBe("default");
    expect(event.changes.after).toBe("allow");
    expect(event.status).toBe("success");

    consoleSpy.mockRestore();
  });

  it("emits delete_sender_rule when rule is reset to default", async () => {
    const repo = new MemoryApiRepository();
    await repo.setSenderRule(owner, sender, "block");

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await setSenderRule(repo, owner, sender, "default", ctx);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const event: PolicyAuditEvent = JSON.parse(consoleSpy.mock.calls[0][0]);

    expect(event.action).toBe("delete_sender_rule");
    expect(event.changes.before).toBe("block");
    expect(event.changes.after).toBe("default");

    consoleSpy.mockRestore();
  });

  it("emits failure audit log when repository operation fails", async () => {
    const repo = new MemoryApiRepository();
    vi.spyOn(repo, "setPolicy").mockRejectedValueOnce(new Error("Database connection lost"));

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const newPolicy = {
      allowUnknown: false,
      minimumPostage: "0",
      requireVerified: true,
    };

    await expect(setMailboxPolicy(repo, owner, newPolicy, ctx)).rejects.toThrow("Database connection lost");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const event: PolicyAuditEvent = JSON.parse(consoleSpy.mock.calls[0][0]);

    expect(event.status).toBe("failure");
    expect(event.error).toBe("Database connection lost");

    consoleSpy.mockRestore();
  });
});
