import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { validateDashboardData, validateSourceReports } from "../guards/analytics-guards.mjs";
import { AnalyticsError, AnalyticsErrorCode } from "../guards/analytics-errors.mjs";
import { generateDashboardReport } from "../services/analytics-dashboard.service.mjs";
import { generateSnapshots } from "../services/analytics-snapshot.service.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(currentDir, "..", "fixtures");

async function loadJson(fileName) {
  const raw = await readFile(join(fixturesDir, fileName), "utf8");
  return JSON.parse(raw);
}

test("AnalyticsError carries a stable machine-readable code", () => {
  const error = new AnalyticsError(AnalyticsErrorCode.INVALID_MEMBERS, "boom");
  assert.ok(error instanceof Error);
  assert.equal(error.name, "AnalyticsError");
  assert.equal(error.code, "INVALID_MEMBERS");
});

test("documented error codes are unique and self-consistent", () => {
  const codes = Object.values(AnalyticsErrorCode);
  assert.equal(new Set(codes).size, codes.length, "error codes must be unique");
  for (const [key, value] of Object.entries(AnalyticsErrorCode)) {
    assert.equal(key, value, "error code key and value should match");
  }
});

test("valid dashboard fixture satisfies the input contract", async () => {
  const data = await loadJson("sample-analytics-data.json");
  assert.doesNotThrow(() => validateDashboardData(data));

  const report = generateDashboardReport(data);
  assert.equal(report.teamId, data.teamId);
  assert.equal(report.members.length, data.members.length);
  assert.ok(Array.isArray(report.summary.reviewRequiredMemberIds));

  const allowed = new Set(["active", "overloaded", "underutilized", "away"]);
  for (const member of report.members) {
    assert.ok(allowed.has(member.status), "unexpected status: " + member.status);
  }
});

test("valid source-report fixture satisfies the snapshot contract", async () => {
  const fixture = await loadJson("sample-team-analytics.json");
  assert.doesNotThrow(() => validateSourceReports(fixture.sourceReports));

  const snapshots = generateSnapshots(fixture.sourceReports);
  assert.deepEqual(snapshots, fixture.expectedSnapshots);
});

test("invalid dashboard payloads raise the documented error codes", async () => {
  const fixture = await loadJson("invalid-analytics-data.json");
  for (const testCase of fixture.dashboardCases) {
    assert.throws(
      () => validateDashboardData(testCase.input),
      (error) => error instanceof AnalyticsError && error.code === testCase.expectedErrorCode,
      "expected " + testCase.expectedErrorCode + " for case " + testCase.name,
    );
  }
});

test("invalid source-report payloads raise the documented error codes", async () => {
  const fixture = await loadJson("invalid-analytics-data.json");
  for (const testCase of fixture.sourceReportCases) {
    assert.throws(
      () => validateSourceReports(testCase.input),
      (error) => error instanceof AnalyticsError && error.code === testCase.expectedErrorCode,
      "expected " + testCase.expectedErrorCode + " for case " + testCase.name,
    );
  }
});
