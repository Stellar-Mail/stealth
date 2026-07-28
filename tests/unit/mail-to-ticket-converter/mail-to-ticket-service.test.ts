import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(
  __dirname,
  "..",
  "..",
  "tools",
  "v2",
  "team",
  "mail-to-ticket-converter",
  "fixtures",
);

function loadJSON(filename: string) {
  return JSON.parse(readFileSync(resolve(fixtureDir, filename), "utf-8"));
}

const sampleEmails = loadJSON("sample-emails.json");
const sampleTickets = loadJSON("sample-tickets.json");
const teamMembers = loadJSON("team-members.json");

function computeMetrics(tickets: any[]) {
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
      expect(sampleEmails.length).toBe(5);
    });

    it("every email has required fields", () => {
      for (const email of sampleEmails) {
        expect(email.id).toBeDefined();
        expect(email.threadId).toBeDefined();
        expect(email.from).toBeDefined();
        expect(email.from.name).toBeDefined();
        expect(email.from.email).toBeDefined();
        expect(email.to).toBeDefined();
        expect(email.subject).toBeDefined();
        expect(email.body).toBeDefined();
        expect(email.receivedAt).toBeDefined();
        expect(typeof email.hasAttachments).toBe("boolean");
      }
    });

    it("all receivedAt dates are parseable", () => {
      for (const email of sampleEmails) {
        const d = new Date(email.receivedAt);
        expect(d instanceof Date && !isNaN(d.getTime())).toBe(true);
      }
    });
  });

  describe("sample-tickets.json", () => {
    it("has 4 ticket entries", () => {
      expect(sampleTickets.length).toBe(4);
    });

    it("every ticket has required fields", () => {
      for (const t of sampleTickets) {
        expect(t.id).toBeDefined();
        expect(t.emailId).toBeDefined();
        expect(t.subject).toBeDefined();
        expect(t.description).toBeDefined();
        expect(["low", "medium", "high", "critical"]).toContain(t.priority);
        expect(["open", "in-progress", "resolved", "closed"]).toContain(t.status);
        expect(["bug", "feature-request", "support", "billing", "other"]).toContain(t.category);
        expect(t.createdAt).toBeDefined();
        expect(t.updatedAt).toBeDefined();
      }
    });

    it("includes tickets in different statuses", () => {
      const statuses = new Set(sampleTickets.map((t) => t.status));
      expect(statuses.has("open")).toBe(true);
      expect(statuses.has("in-progress")).toBe(true);
      expect(statuses.has("resolved")).toBe(true);
    });

    it("status transitions are valid", () => {
      for (const t of sampleTickets) {
        if (t.status === "resolved" || t.status === "closed") {
          expect(t.resolution).toBeDefined();
        }
      }
    });
  });

  describe("team-members.json", () => {
    it("has 5 team members", () => {
      expect(teamMembers.length).toBe(5);
    });

    it("every member has required fields", () => {
      for (const m of teamMembers) {
        expect(m.id).toBeDefined();
        expect(m.name).toBeDefined();
        expect(m.email).toBeDefined();
        expect(m.role).toBeDefined();
      }
    });
  });
});

describe("Mail-to-Ticket Converter — Service Logic", () => {
  describe("computeMetrics", () => {
    it("returns correct totals", () => {
      const metrics = computeMetrics(sampleTickets);
      expect(metrics.totalTickets).toBe(4);
      expect(metrics.openTickets).toBe(2);
      expect(metrics.inProgressTickets).toBe(1);
      expect(metrics.resolvedTickets).toBe(1);
      expect(metrics.closedTickets).toBe(0);
    });

    it("counts by priority correctly", () => {
      const metrics = computeMetrics(sampleTickets);
      expect(metrics.byPriority.critical).toBe(1);
      expect(metrics.byPriority.high).toBe(2);
      expect(metrics.byPriority.low).toBe(1);
      expect(metrics.byPriority.medium).toBe(0);
    });

    it("counts by category correctly", () => {
      const metrics = computeMetrics(sampleTickets);
      expect(metrics.byCategory.bug).toBe(1);
      expect(metrics.byCategory.billing).toBe(1);
      expect(metrics.byCategory["feature-request"]).toBe(1);
      expect(metrics.byCategory.support).toBe(1);
      expect(metrics.byCategory.other).toBe(0);
    });

    it("computes average resolution time for resolved tickets", () => {
      const metrics = computeMetrics(sampleTickets);
      expect(metrics.averageResolutionTimeHours).not.toBeNull();
      expect(metrics.averageResolutionTimeHours).toBeGreaterThan(0);
    });

    it("returns null average resolution time when no tickets resolved", () => {
      const metrics = computeMetrics([]);
      expect(metrics.averageResolutionTimeHours).toBeNull();
    });

    it("handles empty tickets array", () => {
      const metrics = computeMetrics([]);
      expect(metrics.totalTickets).toBe(0);
      expect(metrics.openTickets).toBe(0);
      expect(metrics.inProgressTickets).toBe(0);
      expect(metrics.resolvedTickets).toBe(0);
      expect(metrics.closedTickets).toBe(0);
      expect(metrics.averageResolutionTimeHours).toBeNull();
    });

    it("all priority and category counts default to 0", () => {
      const metrics = computeMetrics([]);
      for (const key of ["low", "medium", "high", "critical"]) {
        expect(metrics.byPriority[key]).toBe(0);
      }
      for (const key of ["bug", "feature-request", "support", "billing", "other"]) {
        expect(metrics.byCategory[key]).toBe(0);
      }
    });
  });
});
