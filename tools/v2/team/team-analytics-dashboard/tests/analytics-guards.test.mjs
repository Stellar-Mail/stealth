import test from "node:test";
import assert from "node:assert";
import { validateDashboardData, validateSourceReports } from "../guards/analytics-guards.mjs";

test("validateDashboardData throws on missing or invalid data", () => {
  assert.throws(() => validateDashboardData(null), /Dashboard data must be an object/);
  assert.throws(() => validateDashboardData("string"), /Dashboard data must be an object/);
  assert.throws(() => validateDashboardData({}), /data.members must be an array/);
});

test("validateDashboardData throws if members array exceeds threshold", () => {
  const members = new Array(501).fill({ memberId: "foo" });
  assert.throws(() => validateDashboardData({ members }), /exceeds the maximum allowed length/);
});

test("validateDashboardData throws on malformed member items", () => {
  assert.throws(() => validateDashboardData({ members: [null] }), /Member items must be objects/);
  assert.throws(() => validateDashboardData({ members: [{}] }), /memberId must be a string/);
});

test("validateDashboardData passes valid payloads", () => {
  assert.doesNotThrow(() => validateDashboardData({ members: [] }));
  assert.doesNotThrow(() => validateDashboardData({ members: [{ memberId: "m1" }] }));
});

test("validateSourceReports throws on non-array input", () => {
  assert.throws(() => validateSourceReports(null), /sourceReports must be an array/);
  assert.throws(() => validateSourceReports({}), /sourceReports must be an array/);
});

test("validateSourceReports throws if reports array exceeds threshold", () => {
  const reports = new Array(1001).fill({});
  assert.throws(() => validateSourceReports(reports), /exceeds the maximum allowed length/);
});

test("validateSourceReports throws on malformed report items", () => {
  assert.throws(() => validateSourceReports(["string"]), /Source report items must be objects/);
});

test("validateSourceReports passes valid reports", () => {
  assert.doesNotThrow(() => validateSourceReports([]));
  assert.doesNotThrow(() => validateSourceReports([{}]));
});
