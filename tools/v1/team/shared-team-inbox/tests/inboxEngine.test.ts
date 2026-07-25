import { describe, expect, it } from "vitest";

import {
  createTeamInbox,
  isAllowedTransition,
  TriageTransitionError,
} from "../services/inboxEngine";
import { SAMPLE_MESSAGES, SEEDED_RECORD } from "../fixtures/inbox.fixtures";
import type { TriageStatus } from "../types";

describe("shared-team-inbox core engine (#445)", () => {
  it("ingests a message as unassigned", () => {
    const inbox = createTeamInbox();
    const rec = inbox.ingest(SAMPLE_MESSAGES[1]);
    expect(rec.status).toBe("unassigned");
    expect(rec.assignee).toBeNull();
    expect(inbox.get("msg-002")?.message.subject).toBe("Q3 invoice follow-up");
  });

  it("rejects duplicate ingest", () => {
    const inbox = createTeamInbox();
    inbox.ingest(SAMPLE_MESSAGES[1]);
    expect(() => inbox.ingest(SAMPLE_MESSAGES[1])).toThrow(/Duplicate message id/);
  });

  it("claims and releases ownership", () => {
    const inbox = createTeamInbox();
    inbox.ingest(SAMPLE_MESSAGES[2]);
    const claimed = inbox.claim("msg-003", "bob");
    expect(claimed.status).toBe("claimed");
    expect(claimed.assignee).toBe("bob");
    const released = inbox.release("msg-003");
    expect(released.status).toBe("unassigned");
    expect(released.assignee).toBeNull();
  });

  it("walks the full triage state machine", () => {
    const inbox = createTeamInbox();
    inbox.ingest(SAMPLE_MESSAGES[0]);
    expect(inbox.claim("msg-001", "alice").status).toBe("claimed");
    expect(inbox.setStatus("msg-001", "in-progress").status).toBe("in-progress");
    expect(inbox.setStatus("msg-001", "awaiting-reply").status).toBe("awaiting-reply");
    expect(inbox.setStatus("msg-001", "resolved").status).toBe("resolved");
    // re-open from resolved
    expect(inbox.setStatus("msg-001", "claimed").status).toBe("claimed");
  });

  it("rejects illegal transitions", () => {
    const inbox = createTeamInbox();
    inbox.ingest(SAMPLE_MESSAGES[0]);
    // unassigned -> in-progress is not allowed directly
    expect(() => inbox.setStatus("msg-001", "in-progress")).toThrow(TriageTransitionError);
  });

  it("isAllowedTransition encodes the contract", () => {
    const allowed: Array<[TriageStatus, TriageStatus]> = [
      ["unassigned", "claimed"],
      ["claimed", "in-progress"],
      ["in-progress", "awaiting-reply"],
      ["awaiting-reply", "resolved"],
      ["resolved", "claimed"],
    ];
    for (const [from, to] of allowed) expect(isAllowedTransition(from, to)).toBe(true);
    expect(isAllowedTransition("unassigned", "resolved")).toBe(false);
  });

  it("adds team-only annotations (sender-invisible by contract)", () => {
    const inbox = createTeamInbox();
    inbox.ingest(SAMPLE_MESSAGES[2]);
    const anno = inbox.annotate("msg-003", "bob", "Looks like a dup of #882");
    expect(anno.author).toBe("bob");
    expect(inbox.get("msg-003")?.annotations).toHaveLength(1);
  });

  it("records a team reply using the shared identity", () => {
    const inbox = createTeamInbox();
    inbox.ingest(SAMPLE_MESSAGES[1]);
    const reply = inbox.reply("msg-002", "alice", "We will look into invoice #2231.");
    expect(reply.author).toBe("alice");
    expect(inbox.get("msg-002")?.replies).toHaveLength(1);
  });

  it("throws on operations against unknown messages", () => {
    const inbox = createTeamInbox();
    expect(() => inbox.claim("nope", "x")).toThrow(/Message not found/);
    expect(() => inbox.annotate("nope", "x", "y")).toThrow(/Message not found/);
  });

  it("lists records optionally filtered by status", () => {
    const inbox = createTeamInbox([SEEDED_RECORD]);
    inbox.ingest(SAMPLE_MESSAGES[1]);
    expect(inbox.list().length).toBe(2);
    expect(inbox.list("claimed").length).toBe(1);
    expect(inbox.list("unassigned").length).toBe(1);
  });
});
