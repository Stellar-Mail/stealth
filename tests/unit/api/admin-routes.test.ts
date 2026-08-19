import { beforeEach, describe, expect, it } from "vitest";
import { MemoryApiRepository } from "@/server/api/memory-repository";
import { Route as DlqRoute } from "@/routes/api/v1/admin/dlq/index";
import { Route as DlqItemRoute } from "@/routes/api/v1/admin/dlq/$id";
import { Route as DlqRetryRoute } from "@/routes/api/v1/admin/dlq/$id/retry";
import { Route as DlqAbandonRoute } from "@/routes/api/v1/admin/dlq/$id/abandon";
import { Route as JobsRoute } from "@/routes/api/v1/admin/jobs/index";
import { Route as JobItemRoute } from "@/routes/api/v1/admin/jobs/$id";
import { enqueueDurableJob, recordJobFailure } from "@/server/api/job-service";
import { getApiContext } from "@/server/api/context";

const dlqListHandler = (DlqRoute.options as any).server?.handlers?.GET;
const dlqItemHandler = (DlqItemRoute.options as any).server?.handlers?.GET;
const dlqRetryHandler = (DlqRetryRoute.options as any).server?.handlers?.POST;
const dlqAbandonHandler = (DlqAbandonRoute.options as any).server?.handlers?.POST;
const jobsListHandler = (JobsRoute.options as any).server?.handlers?.GET;
const jobsItemHandler = (JobItemRoute.options as any).server?.handlers?.GET;

describe("Admin DLQ & Jobs Routes (Issue #1952 BETA-045)", () => {
  let repository: MemoryApiRepository;

  beforeEach(async () => {
    const ctx = await getApiContext();
    repository = ctx.repository as MemoryApiRepository;
    repository.reset?.();
  });

  it("serves GET /api/v1/admin/dlq and GET /api/v1/admin/dlq/:id", async () => {
    const { job } = await enqueueDurableJob(repository, {
      type: "funding",
      idempotencyKey: "admin-route-test-1",
      payload: { amount: 100 },
      maxAttempts: 1,
    });

    const { deadLetter } = await recordJobFailure(
      repository,
      job,
      new Error("Unrecoverable error"),
    );
    expect(deadLetter).toBeDefined();

    // GET /api/v1/admin/dlq
    const listReq = new Request("http://localhost/api/v1/admin/dlq?jobType=funding", {
      method: "GET",
    });
    const listRes = await dlqListHandler({ request: listReq });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as any;
    expect(listBody.data.deadLetters).toHaveLength(1);
    expect(listBody.data.deadLetters[0].deadLetterId).toBe(deadLetter!.deadLetterId);

    // GET /api/v1/admin/dlq/:id
    const itemReq = new Request(`http://localhost/api/v1/admin/dlq/${deadLetter!.deadLetterId}`, {
      method: "GET",
    });
    const itemRes = await dlqItemHandler({
      request: itemReq,
      params: { id: deadLetter!.deadLetterId },
    });
    expect(itemRes.status).toBe(200);
    const itemBody = (await itemRes.json()) as any;
    expect(itemBody.data.deadLetter.deadLetterId).toBe(deadLetter!.deadLetterId);
  });

  it("handles POST /api/v1/admin/dlq/:id/retry and POST /api/v1/admin/dlq/:id/abandon", async () => {
    const { job } = await enqueueDurableJob(repository, {
      type: "delivery",
      idempotencyKey: "admin-route-test-2",
      payload: { messageId: "m1" },
      maxAttempts: 1,
    });

    const { deadLetter } = await recordJobFailure(repository, job, new Error("Delivery timeout"));
    expect(deadLetter).toBeDefined();

    // Retry
    const retryReq = new Request(
      `http://localhost/api/v1/admin/dlq/${deadLetter!.deadLetterId}/retry`,
      {
        method: "POST",
      },
    );
    const retryRes = await dlqRetryHandler({
      request: retryReq,
      params: { id: deadLetter!.deadLetterId },
    });
    expect(retryRes.status).toBe(200);
    const retryBody = (await retryRes.json()) as any;
    expect(retryBody.data.deadLetter.status).toBe("retried");
    expect(retryBody.data.job.status).toBe("pending");

    // Abandon on another dead letter
    const { job: job2 } = await enqueueDurableJob(repository, {
      type: "anchoring",
      idempotencyKey: "admin-route-test-3",
      payload: { root: "r1" },
      maxAttempts: 1,
    });
    const { deadLetter: deadLetter2 } = await recordJobFailure(
      repository,
      job2,
      new Error("Fatal"),
    );

    const abandonReq = new Request(
      `http://localhost/api/v1/admin/dlq/${deadLetter2!.deadLetterId}/abandon`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adminNotes: "Abandoned after triage" }),
      },
    );
    const abandonRes = await dlqAbandonHandler({
      request: abandonReq,
      params: { id: deadLetter2!.deadLetterId },
    });
    expect(abandonRes.status).toBe(200);
    const abandonBody = (await abandonRes.json()) as any;
    expect(abandonBody.data.deadLetter.status).toBe("abandoned");
    expect(abandonBody.data.deadLetter.adminNotes).toBe("Abandoned after triage");
  });

  it("serves GET /api/v1/admin/jobs and GET /api/v1/admin/jobs/:id", async () => {
    const { job } = await enqueueDurableJob(repository, {
      type: "reconciliation",
      idempotencyKey: "admin-route-test-4",
      payload: { date: "2026-08-18" },
    });

    // List
    const listReq = new Request("http://localhost/api/v1/admin/jobs", { method: "GET" });
    const listRes = await jobsListHandler({ request: listReq });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as any;
    expect(listBody.data.jobs.length).toBeGreaterThanOrEqual(1);

    // Get item
    const itemReq = new Request(`http://localhost/api/v1/admin/jobs/${job.jobId}`, {
      method: "GET",
    });
    const itemRes = await jobsItemHandler({
      request: itemReq,
      params: { id: job.jobId },
    });
    expect(itemRes.status).toBe(200);
    const itemBody = (await itemRes.json()) as any;
    expect(itemBody.data.job.jobId).toBe(job.jobId);
  });
});
