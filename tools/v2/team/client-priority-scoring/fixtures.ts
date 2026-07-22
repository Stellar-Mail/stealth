/**
 * fixtures.ts — Client Priority Scoring (execution contract fixtures)
 *
 * Deterministic local fixtures used by the contract tests and as documentation
 * of the contract shape.
 */

import type { ClientForScoring } from "./types";

/** Three clients with differing signal mixes (used for ranking checks). */
export const PRIORITY_FIXTURES: ClientForScoring[] = [
  {
    id: "client-acme",
    name: "Acme",
    signals: [
      { name: "revenue", value: 8, weight: 1 },
      { name: "openTickets", value: 2, weight: 1 },
    ],
  },
  {
    id: "client-globex",
    name: "Globex",
    signals: [
      { name: "revenue", value: 3, weight: 1 },
      { name: "openTickets", value: 0, weight: 1 },
    ],
  },
  {
    id: "client-initech",
    name: "Initech",
    signals: [
      { name: "revenue", value: 15, weight: 1 },
      { name: "openTickets", value: 5, weight: 1 },
    ],
  },
];

/** An empty client set (edge case). */
export const EMPTY_CLIENTS: ClientForScoring[] = [];
