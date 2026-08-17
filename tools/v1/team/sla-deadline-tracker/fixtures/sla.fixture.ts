/**
 * Deterministic local fixtures for the SLA Deadline Tracker (#450).
 *
 * No external/production data. Times are expressed as epoch-ms constants so
 * the core engine can be evaluated deterministically in tests.
 */

import type { SlaPolicy, SlaTrackedItem } from "../types";

/** Policy: 4-hour response budget, warn 30 minutes before the deadline. */
export const STANDARD_SLA_POLICY: SlaPolicy = {
  responseBudgetMs: 4 * 60 * 60 * 1000, // 4h
  warnWindowMs: 30 * 60 * 1000, // 30m
};

/** A fixed "now" used by tests so evaluations are reproducible. */
export const FIXED_NOW = Date.parse("2026-07-23T12:00:00.000Z");

export const SAMPLE_ITEMS: SlaTrackedItem[] = [
  {
    id: "item-1",
    label: "Billing question",
    // started 1h ago, 3h remaining -> on-track
    startedAt: new Date(FIXED_NOW - 1 * 60 * 60 * 1000).toISOString(),
    deadlineAt: new Date(FIXED_NOW + 3 * 60 * 60 * 1000).toISOString(),
    responded: false,
    respondedAt: null,
  },
  {
    id: "item-2",
    label: "Technical issue",
    // started 3h55m ago, 5m remaining (within warn) -> due-soon
    startedAt: new Date(FIXED_NOW - (3 * 60 + 55) * 60 * 1000).toISOString(),
    deadlineAt: new Date(FIXED_NOW + 5 * 60 * 1000).toISOString(),
    responded: false,
    respondedAt: null,
  },
  {
    id: "item-3",
    label: "Shipping delay",
    // deadline passed 10m ago, no response -> breached
    startedAt: new Date(FIXED_NOW - 4 * 60 * 60 * 1000 - 10 * 60 * 1000).toISOString(),
    deadlineAt: new Date(FIXED_NOW - 10 * 60 * 1000).toISOString(),
    responded: false,
    respondedAt: null,
  },
  {
    id: "item-4",
    label: "Greeting",
    // already responded -> responded
    startedAt: new Date(FIXED_NOW - 30 * 60 * 1000).toISOString(),
    deadlineAt: new Date(FIXED_NOW + 3 * 60 * 60 * 1000).toISOString(),
    responded: true,
    respondedAt: new Date(FIXED_NOW - 20 * 60 * 1000).toISOString(),
  },
  {
    id: "item-5",
    label: "No SLA applies",
    // no deadline set -> on-track (nothing to breach)
    startedAt: new Date(FIXED_NOW - 60 * 1000).toISOString(),
    deadlineAt: null,
    responded: false,
    respondedAt: null,
  },
];
