import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFlagQueueView,
  buildFlagRowView,
  describeStatus,
  SEVERITY_PRESENTATION,
  STATUS_PRESENTATION,
} from "../ui/flag-queue-view-model.mjs";

const makeFlag = (overrides = {}) => ({
  id: "flag-1",
  emailId: "email-1",
  threadId: "thread-1",
  reportedBy: "analyst@stealth.test",
  severity: "high",
  category: "phishing",
  status: "new",
  subject: "Suspicious login request",
  senderEmail: "attacker@evil.test",
  description: "Looks like a phishing attempt.",
  evidence: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

test("loading state exposes a polite, busy live region", () => {
  const view = buildFlagQueueView({ phase: "loading" });
  assert.equal(view.state, "loading");
  assert.equal(view.region.ariaBusy, true);
  assert.equal(view.region.ariaLive, "polite");
  assert.ok(view.keyboardShortcuts.length > 0);
  assert.ok(view.focusTargetId);
});

test("error state uses an assertive alert region with a retry focus target", () => {
  const view = buildFlagQueueView({
    phase: "error",
    error: { code: "PERSISTENCE_FAILED", message: "Storage unavailable." },
  });
  assert.equal(view.state, "error");
  assert.equal(view.region.role, "alert");
  assert.equal(view.region.ariaLive, "assertive");
  assert.equal(view.focusTargetId, "flag-queue-retry");
  assert.equal(view.error.retryActionId, "flag-queue-retry");
  assert.ok(view.announcement.includes("Storage unavailable."));
});

test("empty state provides guidance and a focus target", () => {
  const view = buildFlagQueueView({ phase: "loaded", flags: [] });
  assert.equal(view.state, "empty");
  assert.ok(view.guidance.length > 0);
  assert.ok(view.focusTargetId);
  assert.equal(view.region.ariaBusy, false);
});

test("success state builds accessible rows with roving tabindex", () => {
  const flags = [makeFlag({ id: "a" }), makeFlag({ id: "b", severity: "low", status: "resolved" })];
  const view = buildFlagQueueView({ phase: "loaded", flags });
  assert.equal(view.state, "success");
  assert.equal(view.items.length, 2);
  assert.equal(view.items[0].tabIndex, 0);
  assert.equal(view.items[1].tabIndex, -1);
  for (const item of view.items) {
    assert.ok(item.ariaLabel.length > 0);
    assert.ok(item.ariaLabel.includes(item.subject));
    assert.ok(!item.ariaLabel.includes("undefined"));
  }
  assert.equal(view.summary.total, 2);
  assert.equal(view.summary.bySeverity.high, 1);
  assert.equal(view.summary.bySeverity.low, 1);
  assert.equal(view.summary.byStatus.resolved, 1);
});

test("selection moves the roving tabindex to the selected row", () => {
  const flags = [makeFlag({ id: "a" }), makeFlag({ id: "b" })];
  const view = buildFlagQueueView({ phase: "loaded", flags, selectedFlagId: "b" });
  assert.equal(view.items[0].tabIndex, -1);
  assert.equal(view.items[1].tabIndex, 0);
  assert.equal(view.items[1].selected, true);
  assert.equal(view.focusTargetId, "flag-row-b");
});

test("every status and severity has presentation metadata", () => {
  for (const status of ["new", "under-review", "escalated", "resolved", "dismissed"]) {
    assert.ok(STATUS_PRESENTATION[status], `missing status ${status}`);
    assert.ok(describeStatus(status).label.length > 0);
  }
  for (const severity of ["critical", "high", "medium", "low"]) {
    assert.ok(SEVERITY_PRESENTATION[severity], `missing severity ${severity}`);
  }
  assert.equal(STATUS_PRESENTATION.resolved.isTerminal, true);
  assert.equal(STATUS_PRESENTATION.dismissed.isTerminal, true);
  assert.equal(STATUS_PRESENTATION.new.isTerminal, false);
});

test("a row built directly is only focusable at the focusable index", () => {
  const row = buildFlagRowView(makeFlag(), 2, 0);
  assert.equal(row.tabIndex, -1);
  assert.equal(row.selected, false);
  assert.equal(row.severity.value, "high");
  assert.equal(row.status.value, "new");
});
