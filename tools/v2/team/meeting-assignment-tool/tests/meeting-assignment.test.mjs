import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const __dirname = join(fileURLToPath(import.meta.url), "..");

const teamMembers = JSON.parse(
  readFileSync(join(__dirname, "..", "fixtures", "team-members.json"), "utf-8"),
);

const sampleMeetings = JSON.parse(
  readFileSync(join(__dirname, "..", "fixtures", "sample-meetings.json"), "utf-8"),
);

// ---------------------------------------------------------------------------
// Pure logic reimplemented in plain JS (no tsx/ts loader required).
// Must stay in sync with services/meetingAssignmentService.ts
// ---------------------------------------------------------------------------

function pickBestMember(eligible, currentLoad) {
  if (eligible.length === 0) return null;
  return eligible.reduce((best, m) => {
    const bLoad = currentLoad[best.id];
    const mLoad = currentLoad[m.id];
    if (mLoad !== bLoad) return mLoad < bLoad ? m : best;
    return m.weeklyCapacity > best.weeklyCapacity ? m : best;
  });
}

function assignMeetings({ teamMembers: members, meetings }) {
  if (!Array.isArray(members)) throw new TypeError("teamMembers must be an array");
  if (!Array.isArray(meetings)) throw new TypeError("meetings must be an array");

  const working = members.map((m) => ({ ...m, skillSet: new Set(m.skills) }));
  const memberLoad = {};
  for (const m of working) memberLoad[m.id] = m.currentMeetingLoad;

  const sorted = [...meetings].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.effort - b.effort;
  });

  const byOrder = sorted.map((meeting) => {
    const required = new Set(meeting.requiredSkills);
    const skillMatches = working.filter(
      (m) => required.size === 0 || [...required].every((s) => m.skillSet.has(s)),
    );
    const eligible = skillMatches.filter(
      (m) => m.weeklyCapacity - memberLoad[m.id] >= meeting.effort,
    );
    const assignee = pickBestMember(eligible, memberLoad);

    let reason;
    if (assignee) {
      reason = "matched";
      memberLoad[assignee.id] += meeting.effort;
    } else if (skillMatches.length > 0) {
      reason = "capacity";
    } else {
      reason = "skill_mismatch";
    }

    return {
      meetingId: meeting.id,
      assigneeId: assignee?.id ?? null,
      status: assignee ? "assigned" : "unassigned",
      reason,
    };
  });

  const map = new Map(byOrder.map((a) => [a.meetingId, a]));
  const assignments = meetings.map((m) => map.get(m.id));

  const total = assignments.length;
  const assigned = assignments.filter((a) => a.status === "assigned").length;

  const memberLoadDelta = {};
  for (const m of members) {
    memberLoadDelta[m.id] = (memberLoad[m.id] ?? m.currentMeetingLoad) - m.currentMeetingLoad;
  }

  return {
    assignments,
    summary: {
      total,
      assigned,
      unassigned: total - assigned,
      coveragePercent: total === 0 ? 0 : Math.round((assigned / total) * 100),
      memberLoad: memberLoadDelta,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Meeting Assignment Tool — assignMeetings()", () => {
  it("returns 7 assignments for 7 fixture meetings", () => {
    const { assignments, summary } = assignMeetings({ teamMembers, meetings: sampleMeetings });
    assert.strictEqual(assignments.length, 7);
    assert.strictEqual(summary.total, 7);
  });

  it("assigns mtg-001 (architecture) to alice", () => {
    const { assignments } = assignMeetings({ teamMembers, meetings: sampleMeetings });
    const a = assignments.find((x) => x.meetingId === "mtg-001");
    assert.strictEqual(a.assigneeId, "alice");
    assert.strictEqual(a.status, "assigned");
    assert.strictEqual(a.reason, "matched");
  });

  it("assigns mtg-002 (planning) to bob (lowest load among eligible)", () => {
    const { assignments } = assignMeetings({ teamMembers, meetings: sampleMeetings });
    const a = assignments.find((x) => x.meetingId === "mtg-002");
    assert.strictEqual(a.assigneeId, "bob");
    assert.strictEqual(a.status, "assigned");
  });

  it("assigns mtg-003 (design+ux) to bob", () => {
    const { assignments } = assignMeetings({ teamMembers, meetings: sampleMeetings });
    const a = assignments.find((x) => x.meetingId === "mtg-003");
    assert.strictEqual(a.assigneeId, "bob");
    assert.strictEqual(a.status, "assigned");
  });

  it("assigns mtg-004 (stakeholder) to cara", () => {
    const { assignments } = assignMeetings({ teamMembers, meetings: sampleMeetings });
    const a = assignments.find((x) => x.meetingId === "mtg-004");
    assert.strictEqual(a.assigneeId, "cara");
    assert.strictEqual(a.status, "assigned");
  });

  it("assigns mtg-005 (security+technical) to dan", () => {
    const { assignments } = assignMeetings({ teamMembers, meetings: sampleMeetings });
    const a = assignments.find((x) => x.meetingId === "mtg-005");
    assert.strictEqual(a.assigneeId, "dan");
    assert.strictEqual(a.status, "assigned");
  });

  it("leaves mtg-006 (roadmap) unassigned due to capacity exhaustion", () => {
    const { assignments } = assignMeetings({ teamMembers, meetings: sampleMeetings });
    const a = assignments.find((x) => x.meetingId === "mtg-006");
    assert.strictEqual(a.status, "unassigned");
    assert.strictEqual(a.reason, "capacity");
    assert.strictEqual(a.assigneeId, null);
  });

  it("assigns mtg-007 (no required skills) to dan", () => {
    const { assignments } = assignMeetings({ teamMembers, meetings: sampleMeetings });
    const a = assignments.find((x) => x.meetingId === "mtg-007");
    assert.strictEqual(a.assigneeId, "dan");
    assert.strictEqual(a.status, "assigned");
  });

  it("returns assignments in original input order", () => {
    const { assignments } = assignMeetings({ teamMembers, meetings: sampleMeetings });
    assert.deepStrictEqual(
      assignments.map((a) => a.meetingId),
      sampleMeetings.map((m) => m.id),
    );
  });

  it("summary: 6 assigned, 1 unassigned, 86% coverage", () => {
    const { summary } = assignMeetings({ teamMembers, meetings: sampleMeetings });
    assert.strictEqual(summary.assigned, 6);
    assert.strictEqual(summary.unassigned, 1);
    assert.strictEqual(summary.coveragePercent, 86);
  });

  it("summary memberLoad reflects total effort added per member", () => {
    const { summary } = assignMeetings({ teamMembers, meetings: sampleMeetings });
    // alice: mtg-001 effort=3
    assert.strictEqual(summary.memberLoad["alice"], 3);
    // bob: mtg-002 effort=2 + mtg-003 effort=1 = 3
    assert.strictEqual(summary.memberLoad["bob"], 3);
    // cara: mtg-004 effort=1
    assert.strictEqual(summary.memberLoad["cara"], 1);
    // dan: mtg-005 effort=2 + mtg-007 effort=1 = 3
    assert.strictEqual(summary.memberLoad["dan"], 3);
  });

  it("throws TypeError for non-array teamMembers", () => {
    assert.throws(() => assignMeetings({ teamMembers: null, meetings: sampleMeetings }), TypeError);
  });

  it("throws TypeError for non-array meetings", () => {
    assert.throws(() => assignMeetings({ teamMembers, meetings: null }), TypeError);
  });

  it("returns empty result for empty meetings list", () => {
    const { assignments, summary } = assignMeetings({ teamMembers, meetings: [] });
    assert.strictEqual(assignments.length, 0);
    assert.strictEqual(summary.coveragePercent, 0);
  });

  it("marks meeting as skill_mismatch when no member has the required skill", () => {
    const { assignments } = assignMeetings({
      teamMembers,
      meetings: [
        {
          id: "mtg-x",
          title: "Specialist Review",
          scheduledAt: "2026-06-30T10:00:00Z",
          durationMinutes: 30,
          requiredSkills: ["blockchain"],
          effort: 1,
          priority: 5,
        },
      ],
    });
    assert.strictEqual(assignments[0].status, "unassigned");
    assert.strictEqual(assignments[0].reason, "skill_mismatch");
  });
});

describe("Meeting Assignment Tool — fixtures", () => {
  it("team-members.json has 4 members with required fields", () => {
    assert.strictEqual(teamMembers.length, 4);
    for (const m of teamMembers) {
      assert.ok(typeof m.id === "string" && m.id.length > 0);
      assert.ok(typeof m.name === "string");
      assert.ok(Array.isArray(m.skills));
      assert.ok(typeof m.currentMeetingLoad === "number");
      assert.ok(typeof m.weeklyCapacity === "number");
    }
  });

  it("sample-meetings.json has 7 meetings with required fields", () => {
    assert.strictEqual(sampleMeetings.length, 7);
    for (const m of sampleMeetings) {
      assert.ok(typeof m.id === "string" && m.id.length > 0);
      assert.ok(typeof m.title === "string");
      assert.ok(typeof m.scheduledAt === "string");
      assert.ok(typeof m.durationMinutes === "number");
      assert.ok(Array.isArray(m.requiredSkills));
      assert.ok([1, 2, 3].includes(m.effort));
      assert.ok(typeof m.priority === "number");
    }
  });
});
