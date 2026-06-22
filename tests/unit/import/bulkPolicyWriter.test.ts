import { describe, it, expect, beforeEach } from "vitest";
import {
  buildWriteJobs,
  createProgress,
  runBatch,
  createMemoryPolicyApi,
  BATCH_SIZE,
  type PolicyApi,
} from "@/features/contacts/import/bulkPolicyWriter";
import type { ImportedContactRow } from "@/features/contacts/import/types";

const OWNER = "GOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO";
const GA = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const GB = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const GC = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

function makeRow(overrides: Partial<ImportedContactRow> = {}): ImportedContactRow {
  return {
    id: "r1",
    name: "Alice",
    address: GA,
    source: "csv",
    trust: "allow",
    match: null,
    error: null,
    ...overrides,
  };
}

describe("buildWriteJobs", () => {
  it("creates allow jobs for trusted contacts", () => {
    const rows = [makeRow({ trust: "allow" })];
    const jobs = buildWriteJobs(rows, OWNER, "default");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].action).toBe("allow");
    expect(jobs[0].sender).toBe(GA);
  });

  it("creates block jobs for blocked contacts", () => {
    const rows = [makeRow({ trust: "block" })];
    const jobs = buildWriteJobs(rows, OWNER, "default");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].action).toBe("block");
  });

  it("applies fallback trust to default contacts", () => {
    const rows = [makeRow({ trust: "default" })];
    const jobs = buildWriteJobs(rows, OWNER, "allow");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].action).toBe("allow");
  });

  it("skips default contacts when fallback is default", () => {
    const rows = [makeRow({ trust: "default" })];
    const jobs = buildWriteJobs(rows, OWNER, "default");
    expect(jobs).toHaveLength(0);
  });

  it("skips rows with errors", () => {
    const rows = [makeRow({ error: "Invalid address" })];
    const jobs = buildWriteJobs(rows, OWNER, "allow");
    expect(jobs).toHaveLength(0);
  });

  it("handles mixed trust levels", () => {
    const rows: ImportedContactRow[] = [
      makeRow({ id: "r1", trust: "allow", address: GA }),
      makeRow({ id: "r2", trust: "block", address: GB }),
      makeRow({ id: "r3", trust: "default", address: GC }),
    ];
    const jobs = buildWriteJobs(rows, OWNER, "block");
    expect(jobs).toHaveLength(3);
    expect(jobs[0].action).toBe("allow");
    expect(jobs[1].action).toBe("block");
    expect(jobs[2].action).toBe("block");
  });
});

describe("runBatch", () => {
  let api: PolicyApi & { dump(): Record<string, "allow" | "block"> };

  beforeEach(() => {
    api = createMemoryPolicyApi();
  });

  it("completes all jobs in a single batch", async () => {
    const rows = [
      makeRow({ id: "r1", trust: "allow", address: GA }),
      makeRow({ id: "r2", trust: "block", address: GB }),
    ];
    const jobs = buildWriteJobs(rows, OWNER, "default");
    const progress = createProgress(jobs);
    const result = await runBatch(progress, api, OWNER);
    expect(result.succeeded).toBe(2);
    expect(result.status).toBe("completed");
  });

  it("marks failed jobs and retries", async () => {
    const flakyApi: PolicyApi = {
      async setSenderRule() {
        throw new Error("Network error");
      },
      async removeSenderRule() {
        throw new Error("Network error");
      },
    };
    const rows = [makeRow({ trust: "allow", address: GA })];
    const jobs = buildWriteJobs(rows, OWNER, "default");
    const progress = createProgress(jobs);

    const result1 = await runBatch(progress, flakyApi, OWNER);
    // Should be marked pending for retry (retries=1)
    expect(result1.jobs[0].status).toBe("pending");
    expect(result1.jobs[0].retries).toBe(1);
  });

  it("respects batch size", async () => {
    const rows = Array.from({ length: BATCH_SIZE + 10 }, (_, i) => {
      const suffix = String(i).replace(/0/g, "A").padStart(5, "A");
      const body = suffix + "A".repeat(50);
      return makeRow({ id: `r${i}`, trust: "allow", address: `G${body}` });
    });
    const jobs = buildWriteJobs(rows, OWNER, "default");
    const progress = createProgress(jobs);
    const result = await runBatch(progress, api, OWNER);
    // First batch = BATCH_SIZE jobs
    expect(result.succeeded).toBe(BATCH_SIZE);
    expect(result.status).toBe("running");
  });

  it("uses memory API to store rules", async () => {
    const rows = [makeRow({ trust: "allow", address: GA })];
    const jobs = buildWriteJobs(rows, OWNER, "default");
    const progress = createProgress(jobs);
    await runBatch(progress, api, OWNER);
    const dump = api.dump();
    expect(dump[`${OWNER}:${GA}`]).toBe("allow");
  });
});

describe("createMemoryPolicyApi", () => {
  it("stores and retrieves rules", async () => {
    const api = createMemoryPolicyApi();
    await api.setSenderRule(OWNER, GA, "allow");
    const dump = api.dump();
    expect(dump[`${OWNER}:${GA}`]).toBe("allow");
  });

  it("removes rules", async () => {
    const api = createMemoryPolicyApi();
    await api.setSenderRule(OWNER, GA, "allow");
    await api.removeSenderRule(OWNER, GA);
    const dump = api.dump();
    expect(dump[`${OWNER}:${GA}`]).toBeUndefined();
  });
});
