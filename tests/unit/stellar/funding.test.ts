import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { FakeFundingAdapter } from "../../../src/services/stellar/funding-adapter";
import {
  classifyFundingFailure,
  computeFundingBackoffMs,
  fundingOperationIdForUser,
  listPublicFundingQueue,
  MAX_FUNDING_ATTEMPTS,
  redactFundingMessage,
  runFundingOperation,
} from "../../../src/services/stellar/funding";
import { FundingError } from "../../../src/services/stellar/funding-adapter";

const ADDRESS = `G${"C".repeat(55)}`;

describe("BETA-018 funding operations", () => {
  it("classifies timeout, rate-limit, invalid account, and exhausted source", () => {
    expect(classifyFundingFailure(new Error("Funding request timed out")).code).toBe("timeout");
    expect(classifyFundingFailure(new Error("Friendbot funding failed with status 429")).code).toBe(
      "rate_limited",
    );
    expect(classifyFundingFailure(new Error("Invalid public key")).errorClass).toBe("permanent");
    expect(classifyFundingFailure(new Error("Funding source exhausted")).code).toBe(
      "funding_source_exhausted",
    );
    expect(classifyFundingFailure(new Error("Account already exists")).alreadyFunded).toBe(true);
    expect(
      classifyFundingFailure(new FundingError("boom", { errorClass: "transient", code: "timeout" }))
        .code,
    ).toBe("timeout");
  });

  it("redacts secret material from funding error text", () => {
    const secret = `S${"A".repeat(55)}`;
    expect(redactFundingMessage(`seed=${secret} failed`)).not.toContain(secret);
  });

  it("uses bounded exponential backoff", () => {
    expect(computeFundingBackoffMs(1)).toBe(1_000);
    expect(computeFundingBackoffMs(2)).toBe(2_000);
    expect(computeFundingBackoffMs(5)).toBe(16_000);
  });

  it("funds once and treats duplicate callbacks as the same operation", async () => {
    const repository = new MemoryApiRepository();
    const adapter = new FakeFundingAdapter();
    const first = await runFundingOperation({
      repository,
      adapter,
      userId: "usr_dup",
      address: ADDRESS,
    });
    const second = await runFundingOperation({
      repository,
      adapter,
      userId: "usr_dup",
      address: ADDRESS,
    });

    expect(first.operationId).toBe(fundingOperationIdForUser("usr_dup"));
    expect(first.status).toBe("succeeded");
    expect(second.operationId).toBe(first.operationId);
    expect(second.status).toBe("succeeded");
    expect(adapter.callCounts.get(ADDRESS)).toBe(1);
  });

  it("treats an already-funded provider callback as success without a new credit", async () => {
    const repository = new MemoryApiRepository();
    const adapter = new FakeFundingAdapter();
    adapter.failNext(ADDRESS, "already_funded", 1);

    const operation = await runFundingOperation({
      repository,
      adapter,
      userId: "usr_already",
      address: ADDRESS,
    });

    expect(operation.status).toBe("succeeded");
    expect(operation.operationId).toBe(fundingOperationIdForUser("usr_already"));
  });

  it("retries a timeout with backoff instead of failing immediately", async () => {
    const repository = new MemoryApiRepository();
    const adapter = new FakeFundingAdapter();
    adapter.failNext(ADDRESS, "timeout", 1);
    const now = new Date("2026-08-18T12:00:00.000Z");

    const operation = await runFundingOperation({
      repository,
      adapter,
      userId: "usr_timeout",
      address: ADDRESS,
      now,
    });

    expect(operation.status).toBe("retrying");
    expect(operation.lastErrorClass).toBe("transient");
    expect(operation.nextRetryAt).toBe("2026-08-18T12:00:01.000Z");

    const tooSoon = await runFundingOperation({
      repository,
      adapter,
      userId: "usr_timeout",
      address: ADDRESS,
      now: new Date("2026-08-18T12:00:00.500Z"),
    });
    expect(tooSoon.status).toBe("retrying");
    expect(adapter.callCounts.get(ADDRESS)).toBe(1);
  });

  it("lands in failed after exhausted retries", async () => {
    const repository = new MemoryApiRepository();
    const adapter = new FakeFundingAdapter();
    adapter.failNext(ADDRESS, "timeout", MAX_FUNDING_ATTEMPTS);
    let now = new Date("2026-08-18T12:00:00.000Z");
    let operation;

    for (let attempt = 0; attempt < MAX_FUNDING_ATTEMPTS; attempt += 1) {
      operation = await runFundingOperation({
        repository,
        adapter,
        userId: "usr_exhausted",
        address: ADDRESS,
        now,
      });
      now = new Date(now.getTime() + 60_000);
    }

    expect(operation?.status).toBe("failed");
    expect(operation?.attempt).toBe(MAX_FUNDING_ATTEMPTS);
    expect(operation?.nextRetryAt).toBeNull();
  });

  it("resumes the same operation ID after a simulated worker restart", async () => {
    const adapter = new FakeFundingAdapter();
    adapter.failNext(ADDRESS, "rate_limited", 1);
    const firstRepo = new MemoryApiRepository();
    const pending = await runFundingOperation({
      repository: firstRepo,
      adapter,
      userId: "usr_restart",
      address: ADDRESS,
      now: new Date("2026-08-18T12:00:00.000Z"),
    });
    expect(pending.status).toBe("retrying");

    const restarted = new MemoryApiRepository();
    await restarted.setFundingOperation(pending);
    const resumed = await runFundingOperation({
      repository: restarted,
      adapter,
      userId: "usr_restart",
      address: ADDRESS,
      now: new Date("2026-08-18T12:00:05.000Z"),
    });

    expect(resumed.operationId).toBe(pending.operationId);
    expect(resumed.status).toBe("succeeded");
    expect(adapter.callCounts.get(ADDRESS)).toBe(2);
  });

  it("exposes admin queue state without seed fields", async () => {
    const repository = new MemoryApiRepository();
    const adapter = new FakeFundingAdapter();
    await runFundingOperation({
      repository,
      adapter,
      userId: "usr_queue",
      address: ADDRESS,
    });

    const queue = await listPublicFundingQueue(repository, { status: "succeeded" });
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      userId: "usr_queue",
      address: ADDRESS,
      status: "succeeded",
    });
    expect(JSON.stringify(queue[0])).not.toMatch(/encryptedSecret|secretKey|seed/i);
  });
});
