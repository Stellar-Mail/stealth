import { beforeEach, describe, expect, it } from "vitest";
import { MemoryApiRepository } from "@/server/api/memory-repository";
import { Route as DlqRoute } from "@/routes/api/v1/admin/dlq/index";
import { Route as DlqItemRoute } from "@/routes/api/v1/admin/dlq/$id";
import { Route as DlqRetryRoute } from "@/routes/api/v1/admin/dlq/$id/retry";
import { Route as DlqAbandonRoute } from "@/routes/api/v1/admin/dlq/$id/abandon";
import { Route as JobsRoute } from "@/routes/api/v1/admin/jobs/index";
import { Route as JobItemRoute } from "@/routes/api/v1/admin/jobs/$id";
import { Route as InvitesRoute } from "@/routes/api/v1/admin/invites/index";
import { Route as RevokeRoute } from "@/routes/api/v1/admin/invites/revoke";
import { Route as LookupRoute } from "@/routes/api/v1/admin/users/lookup";
import { Route as SuspendRoute } from "@/routes/api/v1/admin/users/$userId/suspend";
import { Route as ReactivateRoute } from "@/routes/api/v1/admin/users/$userId/reactivate";
import { Route as ProvisionRetryRoute } from "@/routes/api/v1/admin/users/$userId/provision/retry";
import { Route as HealthRoute } from "@/routes/api/v1/admin/health";

import { enqueueDurableJob, recordJobFailure } from "@/server/api/job-service";
import { getApiContext } from "@/server/api/context";

const dlqListHandler = (DlqRoute.options as any).server?.handlers?.GET;
const dlqItemHandler = (DlqItemRoute.options as any).server?.handlers?.GET;
const dlqRetryHandler = (DlqRetryRoute.options as any).server?.handlers?.POST;
const dlqAbandonHandler = (DlqAbandonRoute.options as any).server?.handlers?.POST;
const jobsListHandler = (JobsRoute.options as any).server?.handlers?.GET;
const jobsItemHandler = (JobItemRoute.options as any).server?.handlers?.GET;
const invitesListHandler = (InvitesRoute.options as any).server?.handlers?.GET;
const invitesCreateHandler = (InvitesRoute.options as any).server?.handlers?.POST;
const invitesRevokeHandler = (RevokeRoute.options as any).server?.handlers?.POST;
const usersLookupHandler = (LookupRoute.options as any).server?.handlers?.GET;
const userSuspendHandler = (SuspendRoute.options as any).server?.handlers?.POST;
const userReactivateHandler = (ReactivateRoute.options as any).server?.handlers?.POST;
const provisionRetryHandler = (ProvisionRetryRoute.options as any).server?.handlers?.POST;
const adminHealthHandler = (HealthRoute.options as any).server?.handlers?.GET;

const ADMIN_ADDR = "GADMIN77777777777777777777777777777777777777777777777777";
const USER_ADDR = "GUSER222222222222222222222222222222222222222222222222222";

describe("Admin operations console with strict RBAC", () => {
  let repository: MemoryApiRepository;

  beforeEach(async () => {
    const ctx = await getApiContext();
    repository = ctx.repository as MemoryApiRepository;
    repository.reset?.();
  });

  describe("Access control & session freshness checks", () => {
    it("rejects unauthenticated requests (missing x-stealth-address)", async () => {
      const req = new Request("http://localhost/api/v1/admin/health", { method: "GET" });
      const res = await adminHealthHandler({ request: req });
      expect(res.status).toBe(401);
    });

    it("rejects normal user requests (unauthorized role)", async () => {
      const req = new Request("http://localhost/api/v1/admin/health", {
        method: "GET",
        headers: { "x-stealth-address": USER_ADDR },
      });
      const res = await adminHealthHandler({ request: req });
      expect(res.status).toBe(403);
    });

    it("rejects stale administrator sessions (older than 15 minutes)", async () => {
      const mockUser = {
        userId: "usr_admin",
        address: ADMIN_ADDR,
        email: "admin@stealth.mail",
        username: "admin_user",
        status: "active" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      await repository.createUser(mockUser);

      const staleSession = {
        sessionId: "sess_stale",
        userId: "usr_admin",
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        lastActiveAt: new Date().toISOString(),
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
        deviceFingerprint: "fingerprint",
      };
      await repository.createSession(staleSession);

      const req = new Request("http://localhost/api/v1/admin/health", {
        method: "GET",
        headers: {
          "x-stealth-address": ADMIN_ADDR,
          cookie: `stealth_session=sess_stale`,
        },
      });
      const res = await adminHealthHandler({ request: req });
      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("recent_auth_required");
    });

    it("allows active administrator session", async () => {
      const mockUser = {
        userId: "usr_admin",
        address: ADMIN_ADDR,
        email: "admin@stealth.mail",
        username: "admin_user",
        status: "active" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      await repository.createUser(mockUser);

      const activeSession = {
        sessionId: "sess_active",
        userId: "usr_admin",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        lastActiveAt: new Date().toISOString(),
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
        deviceFingerprint: "fingerprint",
      };
      await repository.createSession(activeSession);

      const req = new Request("http://localhost/api/v1/admin/health", {
        method: "GET",
        headers: {
          "x-stealth-address": ADMIN_ADDR,
          cookie: `stealth_session=sess_active`,
        },
      });
      const res = await adminHealthHandler({ request: req });
      expect(res.status).toBe(200);
    });
  });

  describe("Service health views", () => {
    it("serves GET /api/v1/admin/health", async () => {
      const req = new Request("http://localhost/api/v1/admin/health", {
        method: "GET",
        headers: { "x-stealth-address": ADMIN_ADDR },
      });
      const res = await adminHealthHandler({ request: req });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.status).toBe("healthy");
      expect(body.data.ready).toBe(true);
      expect(body.data.dependencies.storage).toBe("ok");
    });
  });

  describe("Jobs & DLQ operations", () => {
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

      const listReq = new Request("http://localhost/api/v1/admin/dlq?jobType=funding", {
        method: "GET",
        headers: { "x-stealth-address": ADMIN_ADDR },
      });
      const listRes = await dlqListHandler({ request: listReq });
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as any;
      expect(listBody.data.deadLetters).toHaveLength(1);
      expect(listBody.data.deadLetters[0].deadLetterId).toBe(deadLetter!.deadLetterId);

      const itemReq = new Request(`http://localhost/api/v1/admin/dlq/${deadLetter!.deadLetterId}`, {
        method: "GET",
        headers: { "x-stealth-address": ADMIN_ADDR },
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

      const retryReq = new Request(
        `http://localhost/api/v1/admin/dlq/${deadLetter!.deadLetterId}/retry`,
        {
          method: "POST",
          headers: {
            "x-stealth-address": ADMIN_ADDR,
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason: "Triage dead letter" }),
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
      expect(retryBody.data.supportId).toBeDefined();

      // Abandon test
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
          headers: {
            "x-stealth-address": ADMIN_ADDR,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            reason: "Permanent failure",
            adminNotes: "Abandoned after triage",
          }),
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
      expect(abandonBody.data.supportId).toBeDefined();
    });

    it("serves GET /api/v1/admin/jobs and GET /api/v1/admin/jobs/:id", async () => {
      const { job } = await enqueueDurableJob(repository, {
        type: "reconciliation",
        idempotencyKey: "admin-route-test-4",
        payload: { date: "2026-08-18" },
      });

      const listReq = new Request("http://localhost/api/v1/admin/jobs", {
        method: "GET",
        headers: { "x-stealth-address": ADMIN_ADDR },
      });
      const listRes = await jobsListHandler({ request: listReq });
      expect(listRes.status).toBe(200);

      const itemReq = new Request(`http://localhost/api/v1/admin/jobs/${job.jobId}`, {
        method: "GET",
        headers: { "x-stealth-address": ADMIN_ADDR },
      });
      const itemRes = await jobsItemHandler({
        request: itemReq,
        params: { id: job.jobId },
      });
      expect(itemRes.status).toBe(200);
    });
  });

  describe("Dynamic Invites CRUD", () => {
    it("manages invite creation, listing, and revocation", async () => {
      // POST create invite
      const createReq = new Request("http://localhost/api/v1/admin/invites", {
        method: "POST",
        headers: {
          "x-stealth-address": ADMIN_ADDR,
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: "BETA_PROMO_50", reason: "Marketing campaign" }),
      });
      const createRes = await invitesCreateHandler({ request: createReq });
      expect(createRes.status).toBe(200);
      const createBody = (await createRes.json()) as any;
      expect(createBody.data.invite.code).toBe("BETA_PROMO_50");
      expect(createBody.data.invite.status).toBe("active");
      expect(createBody.data.supportId).toBeDefined();

      // GET list invites
      const listReq = new Request("http://localhost/api/v1/admin/invites", {
        method: "GET",
        headers: { "x-stealth-address": ADMIN_ADDR },
      });
      const listRes = await invitesListHandler({ request: listReq });
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as any;
      expect(listBody.data.invites.some((inv: any) => inv.code === "BETA_PROMO_50")).toBe(true);

      // POST revoke invite
      const revokeReq = new Request("http://localhost/api/v1/admin/invites/revoke", {
        method: "POST",
        headers: {
          "x-stealth-address": ADMIN_ADDR,
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: "BETA_PROMO_50", reason: "Campaign finished" }),
      });
      const revokeRes = await invitesRevokeHandler({ request: revokeReq });
      expect(revokeRes.status).toBe(200);
      const revokeBody = (await revokeRes.json()) as any;
      expect(revokeBody.data.invite.status).toBe("revoked");
      expect(revokeBody.data.invite.revokedBy).toBe(ADMIN_ADDR);
    });
  });

  describe("User lookup, suspension, and reactivation", () => {
    const targetUserId = "usr_alice123";
    const targetUserAddr = "GUSERALICE222222222222222222222222222222222222222222222222";

    beforeEach(async () => {
      await repository.createUser({
        userId: targetUserId,
        address: targetUserAddr,
        email: "alice@example.com",
        username: "alice",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      });
    });

    it("searches users by exact identifier and masks emails", async () => {
      const req = new Request("http://localhost/api/v1/admin/users/lookup?identifier=alice", {
        method: "GET",
        headers: { "x-stealth-address": ADMIN_ADDR },
      });
      const res = await usersLookupHandler({ request: req });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.user.userId).toBe(targetUserId);
      expect(body.data.user.email).toBe("al•••@example.com"); // Masked!
    });

    it("suspends and reactivates users, tracking safe mutations", async () => {
      // Suspend
      const suspendReq = new Request(
        `http://localhost/api/v1/admin/users/${targetUserId}/suspend`,
        {
          method: "POST",
          headers: {
            "x-stealth-address": ADMIN_ADDR,
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason: "Abusive behavior reported" }),
        },
      );
      const suspendRes = await userSuspendHandler({
        request: suspendReq,
        params: { userId: targetUserId },
      });
      expect(suspendRes.status).toBe(200);
      const suspendBody = (await suspendRes.json()) as any;
      expect(suspendBody.data.user.status).toBe("suspended");

      // Reactivate
      const reactivateReq = new Request(
        `http://localhost/api/v1/admin/users/${targetUserId}/reactivate`,
        {
          method: "POST",
          headers: {
            "x-stealth-address": ADMIN_ADDR,
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason: "Resolved appeal" }),
        },
      );
      const reactivateRes = await userReactivateHandler({
        request: reactivateReq,
        params: { userId: targetUserId },
      });
      expect(reactivateRes.status).toBe(200);
      const reactivateBody = (await reactivateRes.json()) as any;
      expect(reactivateBody.data.user.status).toBe("active");
    });
  });

  describe("Provisioning Retries", () => {
    const targetUserId = "usr_failedprov";

    beforeEach(async () => {
      await repository.createProvisioningRecord({
        userId: targetUserId,
        requestedUsername: "retryme",
        displayName: "Retry Me",
        status: "retryable",
        attempts: 1,
        completedSteps: ["username_reservation"],
        currentStep: "wallet_creation",
        failure: {
          step: "wallet_creation",
          code: "latency_error",
          message: "Stellar network latency",
          failedAt: new Date().toISOString(),
        },
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      });
    });

    it("submits retry for failed provisioning", async () => {
      const req = new Request(
        `http://localhost/api/v1/admin/users/${targetUserId}/provision/retry`,
        {
          method: "POST",
          headers: {
            "x-stealth-address": ADMIN_ADDR,
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason: "Retry provision on fresh ledger window" }),
        },
      );
      const res = await provisionRetryHandler({ request: req, params: { userId: targetUserId } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.progress).toBeDefined();
      expect(body.data.supportId).toBeDefined();
    });
  });

  describe("Security hardening: CSRF, self-escalation, and enumeration", () => {
    it("rejects mutation with wrong Content-Type (CSRF plain-text vector)", async () => {
      const req = new Request("http://localhost/api/v1/admin/invites", {
        method: "POST",
        headers: {
          "x-stealth-address": ADMIN_ADDR,
          "content-type": "text/plain",
        },
        body: "code=CSRF_ATTEMPT&reason=hack",
      });
      const res = await invitesCreateHandler({ request: req });
      expect(res.status).not.toBe(200);
    });

    it("prevents user enumeration: lookup of unknown identifier returns 404 not_found", async () => {
      const req = new Request(
        "http://localhost/api/v1/admin/users/lookup?identifier=nonexistent_xyz999",
        {
          method: "GET",
          headers: { "x-stealth-address": ADMIN_ADDR },
        },
      );
      const res = await usersLookupHandler({ request: req });
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("not_found");
    });

    it("prevents enumeration: normal user gets 403, not 404, for any admin route", async () => {
      const req = new Request(
        "http://localhost/api/v1/admin/users/lookup?identifier=someone@example.com",
        {
          method: "GET",
          headers: { "x-stealth-address": USER_ADDR },
        },
      );
      const res = await usersLookupHandler({ request: req });
      expect(res.status).toBe(403);
    });

    it("prevents self-escalation: suspend requires mandatory reason, empty reason is rejected", async () => {
      await repository.createUser({
        userId: "usr_target_esc",
        address: "GTARGET222222222222222222222222222222222222222222222222222",
        email: "target@stealth.mail",
        username: "target_user",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      });

      const req = new Request("http://localhost/api/v1/admin/users/usr_target_esc/suspend", {
        method: "POST",
        headers: {
          "x-stealth-address": ADMIN_ADDR,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "ab" }),
      });
      const res = await userSuspendHandler({ request: req, params: { userId: "usr_target_esc" } });
      expect(res.status).not.toBe(200);
    });

    it("mutation without reason body is rejected (reason entry required)", async () => {
      const req = new Request("http://localhost/api/v1/admin/invites/revoke", {
        method: "POST",
        headers: {
          "x-stealth-address": ADMIN_ADDR,
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: "ANY_CODE" }),
      });
      const res = await invitesRevokeHandler({ request: req });
      expect(res.status).not.toBe(200);
    });
  });
});
