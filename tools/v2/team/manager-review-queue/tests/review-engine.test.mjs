/**
 * review-engine.test.mjs - Manager Review Queue
 *
 * Tests for the local service behavior. The production service is TypeScript,
 * so these tests mirror the pure queue logic in plain JS and run with Node's
 * built-in test runner without a TS loader.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const sourceFixtureText = readFileSync(
  join(__dirname, "..", "fixtures", "reviewFixtures.ts"),
  "utf-8",
);

const FIXTURES = [
  {
    id: "rev_001",
    submitterId: "usr_892",
    contentSnippet: "Please approve this bulk wire transfer to offshore account.",
    submittedAt: "2026-06-18T10:00:00Z",
    status: "pending",
    riskScore: 85,
  },
  {
    id: "rev_002",
    submitterId: "usr_105",
    contentSnippet: "Update to marketing newsletter template",
    submittedAt: "2026-06-18T11:30:00Z",
    status: "pending",
    riskScore: 12,
  },
  {
    id: "rev_003",
    submitterId: "usr_422",
    contentSnippet: "Password reset request override",
    submittedAt: "2026-06-17T15:45:00Z",
    status: "escalated",
    riskScore: 92,
  },
  {
    id: "rev_004",
    submitterId: "usr_892",
    contentSnippet: "New vendor onboarding documents",
    submittedAt: "2026-06-16T09:15:00Z",
    status: "approved",
    riskScore: 35,
  },
];

function createReviewEngine(initialItems = FIXTURES) {
  let localStore = initialItems.map((item) => ({ ...item }));

  async function fetchReviewQueue(input = {}) {
    let filteredItems = localStore;

    if (input.filters) {
      if (input.filters.status) {
        filteredItems = filteredItems.filter((item) => item.status === input.filters.status);
      }
      if (input.filters.minRiskScore !== undefined) {
        filteredItems = filteredItems.filter(
          (item) => item.riskScore >= input.filters.minRiskScore,
        );
      }
    }

    const offset = input.offset || 0;
    const limit = input.limit || 50;
    const paginatedItems = filteredItems.slice(offset, offset + limit);

    return {
      items: paginatedItems,
      totalCount: filteredItems.length,
    };
  }

  async function updateReviewItemStatus(input) {
    const itemIndex = localStore.findIndex((item) => item.id === input.itemId);

    if (itemIndex === -1) {
      throw new Error(`ReviewItem with ID ${input.itemId} not found.`);
    }

    const updatedItem = {
      ...localStore[itemIndex],
      status: input.newStatus,
    };

    localStore[itemIndex] = updatedItem;

    return updatedItem;
  }

  function resetLocalStore() {
    localStore = initialItems.map((item) => ({ ...item }));
  }

  return { fetchReviewQueue, updateReviewItemStatus, resetLocalStore };
}

describe("Manager Review Queue - service fixtures", () => {
  it("mirrors the review fixture IDs from the TypeScript fixture source", () => {
    const sourceIds = [...sourceFixtureText.matchAll(/id:\s+"([^"]+)"/g)].map((match) => match[1]);

    assert.deepEqual(
      FIXTURES.map((item) => item.id),
      sourceIds,
    );
  });

  it("contains deterministic review items with valid statuses and risk scores", () => {
    assert.equal(FIXTURES.length, 4);

    for (const item of FIXTURES) {
      assert.match(item.id, /^rev_\d{3}$/);
      assert.ok(["pending", "approved", "rejected", "escalated"].includes(item.status));
      assert.equal(typeof item.riskScore, "number");
      assert.ok(item.riskScore >= 0 && item.riskScore <= 100);
      assert.ok(Date.parse(item.submittedAt));
    }
  });
});

describe("Manager Review Queue - fetchReviewQueue", () => {
  let engine;

  beforeEach(() => {
    engine = createReviewEngine();
  });

  it("returns all local items when called without filters", async () => {
    const result = await engine.fetchReviewQueue({});

    assert.equal(result.totalCount, 4);
    assert.deepEqual(
      result.items.map((item) => item.id),
      ["rev_001", "rev_002", "rev_003", "rev_004"],
    );
  });

  it("filters by review status", async () => {
    const result = await engine.fetchReviewQueue({ filters: { status: "pending" } });

    assert.equal(result.totalCount, 2);
    assert.deepEqual(
      result.items.map((item) => item.id),
      ["rev_001", "rev_002"],
    );
  });

  it("filters by minimum risk score", async () => {
    const result = await engine.fetchReviewQueue({ filters: { minRiskScore: 80 } });

    assert.equal(result.totalCount, 2);
    assert.deepEqual(
      result.items.map((item) => item.id),
      ["rev_001", "rev_003"],
    );
  });

  it("combines status and risk filters before pagination", async () => {
    const result = await engine.fetchReviewQueue({
      filters: { status: "pending", minRiskScore: 50 },
      limit: 1,
      offset: 0,
    });

    assert.equal(result.totalCount, 1);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, "rev_001");
  });

  it("applies offset and limit to the filtered results", async () => {
    const result = await engine.fetchReviewQueue({
      filters: { status: "pending" },
      limit: 1,
      offset: 1,
    });

    assert.equal(result.totalCount, 2);
    assert.deepEqual(
      result.items.map((item) => item.id),
      ["rev_002"],
    );
  });
});

describe("Manager Review Queue - updateReviewItemStatus", () => {
  let engine;

  beforeEach(() => {
    engine = createReviewEngine();
  });

  it("updates an existing item and persists the status in later fetches", async () => {
    const updated = await engine.updateReviewItemStatus({
      itemId: "rev_001",
      newStatus: "approved",
    });

    assert.equal(updated.status, "approved");

    const pending = await engine.fetchReviewQueue({ filters: { status: "pending" } });
    assert.deepEqual(
      pending.items.map((item) => item.id),
      ["rev_002"],
    );

    const approved = await engine.fetchReviewQueue({ filters: { status: "approved" } });
    assert.deepEqual(
      approved.items.map((item) => item.id),
      ["rev_001", "rev_004"],
    );
  });

  it("throws a useful error when the target item does not exist", async () => {
    await assert.rejects(
      () => engine.updateReviewItemStatus({ itemId: "rev_missing", newStatus: "rejected" }),
      /ReviewItem with ID rev_missing not found/,
    );
  });

  it("resets the local store to the deterministic fixture state", async () => {
    await engine.updateReviewItemStatus({ itemId: "rev_001", newStatus: "rejected" });
    engine.resetLocalStore();

    const pending = await engine.fetchReviewQueue({ filters: { status: "pending" } });
    assert.deepEqual(
      pending.items.map((item) => item.id),
      ["rev_001", "rev_002"],
    );
  });
});
