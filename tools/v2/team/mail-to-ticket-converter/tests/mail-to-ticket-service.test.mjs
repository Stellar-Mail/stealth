import { describe, it, before } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "..", "fixtures");

function loadJSON(filename) {
  return JSON.parse(readFileSync(resolve(fixtureDir, filename), "utf-8"));
}

const sampleEmails = loadJSON("sample-emails.json");
const sampleTickets = loadJSON("sample-tickets.json");
const teamMembers = loadJSON("team-members.json");

function computeMetrics(tickets) {
  const openTickets = tickets.filter((t) => t.status === "open").length;
  const inProgressTickets = tickets.filter((t) => t.status === "in-progress").length;
  const resolvedTickets = tickets.filter((t) => t.status === "resolved").length;
  const closedTickets = tickets.filter((t) => t.status === "closed").length;

  const byPriority = { low: 0, medium: 0, high: 0, critical: 0 };
  const byCategory = { bug: 0, "feature-request": 0, support: 0, billing: 0, other: 0 };

  for (const t of tickets) {
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
  }

  const resolvedWithTime = tickets
    .filter((t) => t.status === "resolved" || t.status === "closed")
    .map((t) => {
      const created = new Date(t.createdAt).getTime();
      const updated = new Date(t.updatedAt).getTime();
      return (updated - created) / (1000 * 60 * 60);
    });

  const averageResolutionTimeHours =
    resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, v) => sum + v, 0) / resolvedWithTime.length
      : null;

  return {
    totalTickets: tickets.length,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    closedTickets,
    byPriority,
    byCategory,
    averageResolutionTimeHours,
  };
}

describe("Mail-to-Ticket Converter — Fixtures", () => {
  describe("sample-emails.json", () => {
    it("has 5 email entries", () => {
      assert.strictEqual(sampleEmails.length, 5);
    });

    it("every email has required fields", () => {
      for (const email of sampleEmails) {
        assert.ok(email.id, `Email missing id: ${JSON.stringify(email)}`);
        assert.ok(email.threadId, `Email missing threadId: ${email.id}`);
        assert.ok(email.from, `Email missing from: ${email.id}`);
        assert.ok(email.from.name, `Email missing from.name: ${email.id}`);
        assert.ok(email.from.email, `Email missing from.email: ${email.id}`);
        assert.ok(email.to, `Email missing to: ${email.id}`);
        assert.ok(email.subject, `Email missing subject: ${email.id}`);
        assert.ok(email.body, `Email missing body: ${email.id}`);
        assert.ok(email.receivedAt, `Email missing receivedAt: ${email.id}`);
        assert.strictEqual(
          typeof email.hasAttachments,
          "boolean",
          `hasAttachments should be boolean: ${email.id}`,
        );
      }
    });

    it("all receivedAt dates are parseable", () => {
      for (const email of sampleEmails) {
        const d = new Date(email.receivedAt);
        assert.ok(
          d instanceof Date && !isNaN(d.getTime()),
          `Invalid date: ${email.receivedAt} (${email.id})`,
        );
      }
    });
  });

  describe("sample-tickets.json", () => {
    it("has 4 ticket entries", () => {
      assert.strictEqual(sampleTickets.length, 4);
    });

    it("every ticket has required fields", () => {
      for (const t of sampleTickets) {
        assert.ok(t.id, `Ticket missing id`);
        assert.ok(t.emailId, `Ticket missing emailId: ${t.id}`);
        assert.ok(t.subject, `Ticket missing subject: ${t.id}`);
        assert.ok(t.description, `Ticket missing description: ${t.id}`);
        assert.ok(
          ["low", "medium", "high", "critical"].includes(t.priority),
          `Invalid priority: ${t.priority} (${t.id})`,
        );
        assert.ok(
          ["open", "in-progress", "resolved", "closed"].includes(t.status),
          `Invalid status: ${t.status} (${t.id})`,
        );
        assert.ok(
          ["bug", "feature-request", "support", "billing", "other"].includes(t.category),
          `Invalid category: ${t.category} (${t.id})`,
        );
        assert.ok(t.createdAt, `Ticket missing createdAt: ${t.id}`);
        assert.ok(t.updatedAt, `Ticket missing updatedAt: ${t.id}`);
      }
    });

    it("includes tickets in different statuses", () => {
      const statuses = new Set(sampleTickets.map((t) => t.status));
      assert.ok(statuses.has("open"), "No open tickets");
      assert.ok(statuses.has("in-progress"), "No in-progress tickets");
      assert.ok(statuses.has("resolved"), "No resolved tickets");
    });

    it("status transitions are valid", () => {
      for (const t of sampleTickets) {
        if (t.status === "resolved" || t.status === "closed") {
          assert.ok(t.resolution, `Resolved/closed ticket missing resolution: ${t.id}`);
        }
      }
    });
  });

  describe("team-members.json", () => {
    it("has 5 team members", () => {
      assert.strictEqual(teamMembers.length, 5);
    });

    it("every member has required fields", () => {
      for (const m of teamMembers) {
        assert.ok(m.id, `Member missing id`);
        assert.ok(m.name, `Member missing name: ${m.id}`);
        assert.ok(m.email, `Member missing email: ${m.id}`);
        assert.ok(m.role, `Member missing role: ${m.id}`);
      }
    });
  });
});

describe("Mail-to-Ticket Converter — Service Logic", () => {
  describe("computeMetrics", () => {
    it("returns correct totals", () => {
      const metrics = computeMetrics(sampleTickets);
      assert.strictEqual(metrics.totalTickets, 4);
      assert.strictEqual(metrics.openTickets, 2);
      assert.strictEqual(metrics.inProgressTickets, 1);
      assert.strictEqual(metrics.resolvedTickets, 1);
      assert.strictEqual(metrics.closedTickets, 0);
    });

    it("counts by priority correctly", () => {
      const metrics = computeMetrics(sampleTickets);
      assert.strictEqual(metrics.byPriority.critical, 1);
      assert.strictEqual(metrics.byPriority.high, 2);
      assert.strictEqual(metrics.byPriority.low, 1);
      assert.strictEqual(metrics.byPriority.medium, 0);
    });

    it("counts by category correctly", () => {
      const metrics = computeMetrics(sampleTickets);
      assert.strictEqual(metrics.byCategory.bug, 1);
      assert.strictEqual(metrics.byCategory.billing, 1);
      assert.strictEqual(metrics.byCategory["feature-request"], 1);
      assert.strictEqual(metrics.byCategory.support, 1);
      assert.strictEqual(metrics.byCategory.other, 0);
    });

    it("computes average resolution time for resolved tickets", () => {
      const metrics = computeMetrics(sampleTickets);
      assert.ok(metrics.averageResolutionTimeHours !== null, "Should have a resolution time");
      // ticket-004: resolved in ~20.5 hours
      assert.ok(metrics.averageResolutionTimeHours > 0, "Resolution time should be positive");
    });

    it("returns null average resolution time when no tickets resolved", () => {
      const metrics = computeMetrics([]);
      assert.strictEqual(metrics.averageResolutionTimeHours, null);
    });

    it("handles empty tickets array", () => {
      const metrics = computeMetrics([]);
      assert.strictEqual(metrics.totalTickets, 0);
      assert.strictEqual(metrics.openTickets, 0);
      assert.strictEqual(metrics.inProgressTickets, 0);
      assert.strictEqual(metrics.resolvedTickets, 0);
      assert.strictEqual(metrics.closedTickets, 0);
      assert.strictEqual(metrics.averageResolutionTimeHours, null);
    });

    it("all priority and category counts default to 0", () => {
      const metrics = computeMetrics([]);
      for (const key of ["low", "medium", "high", "critical"]) {
        assert.strictEqual(metrics.byPriority[key], 0, `byPriority.${key} should be 0`);
      }
      for (const key of ["bug", "feature-request", "support", "billing", "other"]) {
        assert.strictEqual(metrics.byCategory[key], 0, `byCategory.${key} should be 0`);
      }
    });
  });
});
