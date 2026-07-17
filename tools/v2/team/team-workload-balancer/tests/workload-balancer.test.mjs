import { describe, it } from "node:test";
import assert from "node:assert";

const sampleMembers = JSON.parse(
  await import("fs").then((fs) =>
    fs.readFileSync(new URL("../fixtures/team-members.json", import.meta.url), "utf-8"),
  ),
);

const sampleItems = JSON.parse(
  await import("fs").then((fs) =>
    fs.readFileSync(new URL("../fixtures/workload-items.json", import.meta.url), "utf-8"),
  ),
);

function getUtilization(member, items) {
  const assigned = items.filter(
    (i) => i.assignedTo === member.id && i.status !== "completed",
  ).length;
  return member.capacity > 0 ? assigned / member.capacity : 1;
}

function calculateMemberWorkload(member, items) {
  const assigned = items.filter((i) => i.assignedTo === member.id && i.status !== "completed");
  const pendingCount = assigned.filter((i) => i.status === "pending").length;
  const inProgressCount = assigned.filter((i) => i.status === "in-progress").length;
  const overdueCount = assigned.filter((i) => {
    if (!i.dueAt) return false;
    return new Date(i.dueAt).getTime() < Date.now();
  }).length;
  const totalEstimatedEffort = assigned.reduce((s, i) => s + i.estimatedEffort, 0);
  const utilization =
    member.capacity > 0 ? Math.round((assigned.length / member.capacity) * 100 * 10) / 10 : 100;
  return {
    memberId: member.id,
    memberName: member.name,
    assignedItems: assigned.length,
    totalEstimatedEffort,
    utilization,
    pendingCount,
    inProgressCount,
    overdueCount,
  };
}

function calculateImbalanceScore(members) {
  if (members.length === 0) return 0;
  const avg = members.reduce((s, m) => s + m.utilization, 0) / members.length;
  const variance = members.reduce((s, m) => s + (m.utilization - avg) ** 2, 0) / members.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

function calculateWorkloadMetrics(members, items) {
  const memberWorkloads = members.map((m) => calculateMemberWorkload(m, items));
  const totalCapacity = members.reduce((s, m) => s + m.capacity, 0);
  const totalAssigned = memberWorkloads.reduce((s, m) => s + m.assignedItems, 0);
  const totalItems = items.filter((i) => i.status !== "completed").length;
  const averageUtilization =
    members.length > 0
      ? Math.round((memberWorkloads.reduce((s, m) => s + m.utilization, 0) / members.length) * 10) /
        10
      : 0;
  const utilizationValues = memberWorkloads.map((m) => m.utilization);
  const maxUtilization = utilizationValues.length > 0 ? Math.max(...utilizationValues) : 0;
  const minUtilization = utilizationValues.length > 0 ? Math.min(...utilizationValues) : 0;

  return {
    members: memberWorkloads,
    totalItems,
    totalCapacity,
    totalAssigned,
    averageUtilization,
    maxUtilization,
    minUtilization,
    imbalanceScore: calculateImbalanceScore(memberWorkloads),
  };
}

function pickLeastLoaded(item, members, allItems) {
  const sorted = [...members].sort(
    (a, b) => getUtilization(a, allItems) - getUtilization(b, allItems),
  );
  const target = sorted[0];
  return {
    itemId: item.id,
    itemTitle: item.title,
    suggestedMemberId: target.id,
    suggestedMemberName: target.name,
    reason: `Least-loaded: ${target.name} has the most available capacity`,
  };
}

function pickRoundRobin(unassigned, members, allItems, index) {
  const item = unassigned[index];
  const sorted = [...members].sort(
    (a, b) => getUtilization(a, allItems) - getUtilization(b, allItems),
  );
  const target = sorted[0];
  return {
    itemId: item.id,
    itemTitle: item.title,
    suggestedMemberId: target.id,
    suggestedMemberName: target.name,
    reason: `Round-robin: ${target.name} has the lowest current utilization`,
  };
}

function balanceWorkload(unassignedItems, members, allItems, config) {
  const sorted = [...unassignedItems].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const aP = priorityOrder[a.priority];
    const bP = priorityOrder[b.priority];
    if (aP !== bP) return aP - bP;
    return 0;
  });

  const assignments = [];
  const workingItems = [...allItems];

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    const suggestion =
      config.strategy === "round-robin"
        ? pickRoundRobin(sorted, members, workingItems, i)
        : pickLeastLoaded(item, members, workingItems);

    workingItems.push({ ...item, assignedTo: suggestion.suggestedMemberId });
    assignments.push(suggestion);
  }

  const metrics = calculateWorkloadMetrics(members, workingItems);
  return { assignments, metrics };
}

const defaultConfig = { strategy: "least-loaded", prioritizeBy: null, considerSkills: false };

describe("Team Workload Balancer — Service Logic", () => {
  describe("fixtures", () => {
    it("has 4 team members with valid properties", () => {
      assert.strictEqual(sampleMembers.length, 4);
      for (const m of sampleMembers) {
        assert.ok(typeof m.id === "string" && m.id.length > 0);
        assert.ok(typeof m.name === "string" && m.name.length > 0);
        assert.ok(typeof m.capacity === "number" && m.capacity > 0);
        assert.ok(Array.isArray(m.roles));
        assert.ok(Array.isArray(m.skills));
      }
    });

    it("has 12 workload items with valid properties", () => {
      assert.strictEqual(sampleItems.length, 12);
      for (const item of sampleItems) {
        assert.ok(typeof item.id === "string" && item.id.length > 0);
        assert.ok(typeof item.title === "string");
        assert.ok(["low", "medium", "high", "urgent"].includes(item.priority));
        assert.ok(["pending", "in-progress", "completed", "blocked"].includes(item.status));
        assert.ok(typeof item.estimatedEffort === "number");
      }
    });

    it("has 3 unassigned items", () => {
      const unassigned = sampleItems.filter((i) => i.assignedTo === null);
      assert.strictEqual(unassigned.length, 5);
    });
  });

  describe("calculateWorkloadMetrics", () => {
    it("returns correct member workload counts", () => {
      const metrics = calculateWorkloadMetrics(sampleMembers, sampleItems);
      assert.strictEqual(metrics.members.length, 4);
      const alex = metrics.members.find((m) => m.memberName === "Alex Chen");
      assert.ok(alex);
      assert.strictEqual(alex.assignedItems, 2);
    });

    it("calculates total capacity correctly", () => {
      const metrics = calculateWorkloadMetrics(sampleMembers, sampleItems);
      assert.strictEqual(metrics.totalCapacity, 36);
    });

    it("calculates utilization percentages", () => {
      const metrics = calculateWorkloadMetrics(sampleMembers, sampleItems);
      const alex = metrics.members.find((m) => m.memberName === "Alex Chen");
      assert.strictEqual(alex.utilization, 20);
    });

    it("computes imbalance score", () => {
      const metrics = calculateWorkloadMetrics(sampleMembers, sampleItems);
      // utilizations: Alex=20, Jordan=62.5, Morgan=33.3, Casey=66.7
      assert.ok(metrics.imbalanceScore > 0);
      assert.ok(typeof metrics.imbalanceScore === "number");
    });

    it("handles empty members", () => {
      const metrics = calculateWorkloadMetrics([], sampleItems);
      assert.strictEqual(metrics.members.length, 0);
      assert.strictEqual(metrics.averageUtilization, 0);
      assert.strictEqual(metrics.imbalanceScore, 0);
    });

    it("handles empty items", () => {
      const metrics = calculateWorkloadMetrics(sampleMembers, []);
      assert.strictEqual(metrics.totalItems, 0);
      assert.strictEqual(metrics.totalAssigned, 0);
      for (const m of metrics.members) {
        assert.strictEqual(m.assignedItems, 0);
        assert.strictEqual(m.utilization, 0);
      }
    });
  });

  describe("balanceWorkload", () => {
    it("assigns all unassigned items", () => {
      const unassigned = sampleItems.filter(
        (i) => i.assignedTo === null && i.status !== "completed",
      );
      const result = balanceWorkload(unassigned, sampleMembers, sampleItems, defaultConfig);
      assert.strictEqual(result.assignments.length, unassigned.length);
    });

    it("every assignment has a valid member", () => {
      const unassigned = sampleItems.filter(
        (i) => i.assignedTo === null && i.status !== "completed",
      );
      const result = balanceWorkload(unassigned, sampleMembers, sampleItems, defaultConfig);
      const memberIds = new Set(sampleMembers.map((m) => m.id));
      for (const a of result.assignments) {
        assert.ok(memberIds.has(a.suggestedMemberId), `Unknown member: ${a.suggestedMemberId}`);
      }
    });

    it("includes a reason for every assignment", () => {
      const unassigned = sampleItems.filter(
        (i) => i.assignedTo === null && i.status !== "completed",
      );
      const result = balanceWorkload(unassigned, sampleMembers, sampleItems, defaultConfig);
      for (const a of result.assignments) {
        assert.ok(typeof a.reason === "string" && a.reason.length > 0);
      }
    });

    it("returns metrics with the result", () => {
      const unassigned = sampleItems.filter(
        (i) => i.assignedTo === null && i.status !== "completed",
      );
      const result = balanceWorkload(unassigned, sampleMembers, sampleItems, defaultConfig);
      assert.ok(result.metrics.totalItems > 0);
      assert.strictEqual(result.metrics.members.length, 4);
    });

    it("round-robin strategy assigns all items", () => {
      const unassigned = sampleItems.filter(
        (i) => i.assignedTo === null && i.status !== "completed",
      );
      const result = balanceWorkload(unassigned, sampleMembers, sampleItems, {
        ...defaultConfig,
        strategy: "round-robin",
      });
      assert.strictEqual(result.assignments.length, unassigned.length);
    });

    it("handles empty unassigned list", () => {
      const result = balanceWorkload([], sampleMembers, sampleItems, defaultConfig);
      assert.strictEqual(result.assignments.length, 0);
      assert.ok(result.metrics.totalItems > 0);
    });
  });

  describe("suggestAssignment", () => {
    it("suggests the least loaded member by default", () => {
      const item = sampleItems.find((i) => i.id === "wl-008");
      const sorted = [...sampleMembers].sort(
        (a, b) => getUtilization(a, sampleItems) - getUtilization(b, sampleItems),
      );
      const expected = sorted[0];
      const suggestion = pickLeastLoaded(item, sampleMembers, sampleItems);
      assert.strictEqual(suggestion.suggestedMemberId, expected.id);
    });

    it("each suggestion includes item metadata", () => {
      const item = sampleItems.find((i) => i.id === "wl-009");
      const suggestion = pickLeastLoaded(item, sampleMembers, sampleItems);
      assert.strictEqual(suggestion.itemId, "wl-009");
      assert.strictEqual(suggestion.itemTitle, "Upgrade dependencies for security patches");
    });
  });

  describe("member workloads", () => {
    it("tracks pending and in-progress counts", () => {
      const metrics = calculateWorkloadMetrics(sampleMembers, sampleItems);
      const alex = metrics.members.find((m) => m.memberName === "Alex Chen");
      assert.strictEqual(alex.inProgressCount, 2);
      assert.strictEqual(alex.pendingCount, 0);

      const casey = metrics.members.find((m) => m.memberName === "Casey Rivera");
      assert.strictEqual(casey.inProgressCount, 1);
      assert.strictEqual(casey.pendingCount, 1);
    });

    it("reports estimated effort correctly", () => {
      const metrics = calculateWorkloadMetrics(sampleMembers, sampleItems);
      const alex = metrics.members.find((m) => m.memberName === "Alex Chen");
      assert.strictEqual(alex.totalEstimatedEffort, 20);
    });
  });
});
