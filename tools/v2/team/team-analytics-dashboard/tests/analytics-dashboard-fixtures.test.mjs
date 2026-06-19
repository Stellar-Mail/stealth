import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-analytics-data.json");
const servicePath = join(currentDir, "..", "services", "analytics-dashboard.service.mjs");

const allowedStatuses = new Set(["active", "overloaded", "underutilized", "away"]);
const SLA_THRESHOLD_HOURS = 4;
const OVERLOAD_OPEN_THRESHOLD = 10;
const OVERLOAD_SLA_BREACH_THRESHOLD = 2;

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("fixture loads and declares the correct tool identity", async () => {
  const fixture = await loadFixture();
  assert.equal(fixture.tool, "team-analytics-dashboard");
  assert.ok(
    Number.isInteger(fixture.version) && fixture.version > 0,
    "version must be a positive integer",
  );
  assert.ok(fixture.teamId, "teamId is required");
});

test("period block contains valid ISO dates and a label", async () => {
  const { period } = await loadFixture();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  assert.match(period.start, isoDate, "period.start must be ISO date");
  assert.match(period.end, isoDate, "period.end must be ISO date");
  assert.ok(period.label, "period.label is required");
  assert.ok(period.start <= period.end, "period.start must not be after period.end");
});

test("members array contains at least one member with required fields", async () => {
  const { members } = await loadFixture();
  assert.ok(Array.isArray(members) && members.length > 0, "members must be a non-empty array");

  for (const m of members) {
    assert.ok(m.memberId, `${m.name ?? "unknown"}: memberId is required`);
    assert.ok(m.name, `${m.memberId}: name is required`);
    assert.ok(
      Number.isFinite(m.emailsReceived) && m.emailsReceived >= 0,
      `${m.memberId}: emailsReceived must be >= 0`,
    );
    assert.ok(
      Number.isFinite(m.emailsHandled) && m.emailsHandled >= 0,
      `${m.memberId}: emailsHandled must be >= 0`,
    );
    assert.ok(
      m.emailsHandled <= m.emailsReceived,
      `${m.memberId}: emailsHandled cannot exceed emailsReceived`,
    );
    assert.ok(
      Number.isFinite(m.openThreads) && m.openThreads >= 0,
      `${m.memberId}: openThreads must be >= 0`,
    );
    assert.ok(
      Number.isFinite(m.resolvedThreads) && m.resolvedThreads >= 0,
      `${m.memberId}: resolvedThreads must be >= 0`,
    );
    assert.ok(
      Number.isFinite(m.slaBreaches) && m.slaBreaches >= 0,
      `${m.memberId}: slaBreaches must be >= 0`,
    );
    assert.ok(
      allowedStatuses.has(m.status),
      `${m.memberId}: status "${m.status}" is not in the allowed set`,
    );

    if (m.status === "away") {
      assert.equal(
        m.avgResponseTimeHours,
        null,
        `${m.memberId}: away members must have null avgResponseTimeHours`,
      );
    } else {
      assert.ok(
        Number.isFinite(m.avgResponseTimeHours) && m.avgResponseTimeHours >= 0,
        `${m.memberId}: avgResponseTimeHours must be a non-negative number`,
      );
    }
  }
});

test("all four member statuses are represented", async () => {
  const { members } = await loadFixture();
  const seen = new Set(members.map((m) => m.status));
  for (const s of allowedStatuses) {
    assert.ok(seen.has(s), `fixture must include at least one member with status "${s}"`);
  }
});

test("overloaded status is consistent with open-thread or SLA thresholds", async () => {
  const { members } = await loadFixture();
  for (const m of members) {
    if (m.status === "overloaded") {
      const isOverloaded =
        m.openThreads > OVERLOAD_OPEN_THRESHOLD || m.slaBreaches > OVERLOAD_SLA_BREACH_THRESHOLD;
      assert.ok(
        isOverloaded,
        `${m.memberId}: overloaded status requires openThreads > ${OVERLOAD_OPEN_THRESHOLD} or slaBreaches > ${OVERLOAD_SLA_BREACH_THRESHOLD}`,
      );
    }
  }
});

test("summary totals are consistent with member data", async () => {
  const { members, summary } = await loadFixture();

  const expectedVolume = members.reduce((n, m) => n + m.emailsReceived, 0);
  const expectedHandled = members.reduce((n, m) => n + m.emailsHandled, 0);
  const expectedOpen = members.reduce((n, m) => n + m.openThreads, 0);
  const expectedBreaches = members.reduce((n, m) => n + m.slaBreaches, 0);

  assert.equal(
    summary.totalEmailVolume,
    expectedVolume,
    "summary.totalEmailVolume must equal sum of member emailsReceived",
  );
  assert.equal(
    summary.totalHandled,
    expectedHandled,
    "summary.totalHandled must equal sum of member emailsHandled",
  );
  assert.equal(
    summary.totalOpen,
    expectedOpen,
    "summary.totalOpen must equal sum of member openThreads",
  );
  assert.equal(
    summary.totalSlaBreaches,
    expectedBreaches,
    "summary.totalSlaBreaches must equal sum of member slaBreaches",
  );
});

test("topPerformer and bottleneck reference valid member IDs", async () => {
  const { members, summary } = await loadFixture();
  const memberIds = new Set(members.map((m) => m.memberId));
  assert.ok(
    memberIds.has(summary.topPerformerId),
    "summary.topPerformerId must match a member in the fixture",
  );
  assert.ok(
    memberIds.has(summary.bottleneckMemberId),
    "summary.bottleneckMemberId must match a member in the fixture",
  );
});

test("reviewRequiredMemberIds contains all members with SLA breaches", async () => {
  const { members, summary } = await loadFixture();
  const reviewSet = new Set(summary.reviewRequiredMemberIds);
  for (const m of members) {
    if (m.slaBreaches > 0) {
      assert.ok(
        reviewSet.has(m.memberId),
        `${m.memberId} has slaBreaches > 0 and must be in reviewRequiredMemberIds`,
      );
    }
  }
});

test("topPerformer is active and has zero SLA breaches", async () => {
  const { members, summary } = await loadFixture();
  const top = members.find((m) => m.memberId === summary.topPerformerId);
  assert.ok(top, "topPerformerId must match a member");
  assert.equal(top.status, "active", "topPerformer must have active status");
  assert.equal(top.slaBreaches, 0, "topPerformer must have zero SLA breaches");
});

test("bottleneck member has the highest open thread count", async () => {
  const { members, summary } = await loadFixture();
  const bottleneck = members.find((m) => m.memberId === summary.bottleneckMemberId);
  assert.ok(bottleneck, "bottleneckMemberId must match a member");
  const maxOpen = Math.max(...members.map((m) => m.openThreads));
  assert.equal(
    bottleneck.openThreads,
    maxOpen,
    "bottleneck member must have the highest openThreads count",
  );
});

test("dashboard service produces matching output from fixture input", async () => {
  const fixture = await loadFixture();
  const { generateDashboardReport } = await import(pathToFileURL(servicePath).href);

  const result = generateDashboardReport({
    members: fixture.members,
    period: fixture.period,
    teamId: fixture.teamId,
  });

  assert.equal(result.teamId, fixture.teamId);
  assert.equal(result.period.label, fixture.period.label);
  assert.equal(result.members.length, fixture.members.length);
  assert.equal(result.summary.totalEmailVolume, fixture.summary.totalEmailVolume);
  assert.equal(result.summary.totalHandled, fixture.summary.totalHandled);
  assert.equal(result.summary.totalOpen, fixture.summary.totalOpen);
  assert.equal(result.summary.totalSlaBreaches, fixture.summary.totalSlaBreaches);
  assert.equal(result.summary.topPerformerId, fixture.summary.topPerformerId);
  assert.equal(result.summary.bottleneckMemberId, fixture.summary.bottleneckMemberId);
  assert.deepEqual(result.summary.reviewRequiredMemberIds, fixture.summary.reviewRequiredMemberIds);

  for (let i = 0; i < result.members.length; i++) {
    const actual = result.members[i];
    const expected = fixture.members[i];
    assert.equal(actual.memberId, expected.memberId, `member ${i} memberId mismatch`);
    assert.equal(actual.status, expected.status, `member ${i} status mismatch`);
    assert.equal(
      actual.avgResponseTimeHours,
      expected.avgResponseTimeHours,
      `member ${i} avgResponseTimeHours mismatch`,
    );
    assert.equal(actual.slaBreaches, expected.slaBreaches, `member ${i} slaBreaches mismatch`);
  }
});
