/**
 * BETA-084 (Issue #1991) — Admin route authorization regressions.
 * Control owner: admin-platform.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Route as DlqRoute } from "@/routes/api/v1/admin/dlq/index";
import { Route as DlqItemRoute } from "@/routes/api/v1/admin/dlq/$id";
import { Route as DlqRetryRoute } from "@/routes/api/v1/admin/dlq/$id/retry";
import { Route as JobsRoute } from "@/routes/api/v1/admin/jobs/index";
import { ADMIN_ADDRESSES_ENV } from "@/server/api/admin-auth";
import { ACTOR_HEADER } from "@/server/api/actor";
import { enqueueDurableJob, recordJobFailure } from "@/server/api/job-service";
import { getApiContext } from "@/server/api/context";
import type { MemoryApiRepository } from "@/server/api/memory-repository";
import {
  ALICE_ADDRESS,
  BOB_ADDRESS,
  classifyDenial,
  seedTwoUserIsolationFixture,
} from "../../../fixtures/security-isolation";

import { getRouteHandler } from "../../../helpers/route-handler";

const ADMIN_ADDRESS = `G${"Z".repeat(55)}`;

function actorRequest(path: string, method: string, actor?: string): Request {
  const headers: Record<string, string> = {};
  if (actor) headers[ACTOR_HEADER] = actor;
  return new Request(`https://stealth.test${path}`, { method, headers });
}

describe("BETA-084 (Issue #1991): Admin Route Authorization", () => {
  let repo: MemoryApiRepository;
  let deadLetterId: string;
  const previousAdminEnv = process.env[ADMIN_ADDRESSES_ENV];

  beforeEach(async () => {
    process.env[ADMIN_ADDRESSES_ENV] = ADMIN_ADDRESS;
    await seedTwoUserIsolationFixture();
    repo = (await getApiContext()).repository as MemoryApiRepository;

    const { job } = await enqueueDurableJob(repo, {
      type: "funding",
      idempotencyKey: "admin-sec-test-1",
      payload: { amount: 100 },
      maxAttempts: 1,
    });
    const { deadLetter } = await recordJobFailure(repo, job, new Error("test failure"));
    deadLetterId = deadLetter!.deadLetterId;
  });

  afterEach(() => {
    if (previousAdminEnv === undefined) delete process.env[ADMIN_ADDRESSES_ENV];
    else process.env[ADMIN_ADDRESSES_ENV] = previousAdminEnv;
  });

  describe("unauthenticated admin access [control: admin-platform]", () => {
    it("denies unauthenticated DLQ listing", async () => {
      const res = await getRouteHandler(
        DlqRoute,
        "GET",
      )({ request: actorRequest("/api/v1/admin/dlq/", "GET") });
      expect(classifyDenial(res.status)).toBe("denied");
      expect(res.status).toBe(401);
    });

    it("denies unauthenticated DLQ item read", async () => {
      const res = await getRouteHandler(
        DlqItemRoute,
        "GET",
      )({
        request: actorRequest(`/api/v1/admin/dlq/${deadLetterId}`, "GET"),
        params: { id: deadLetterId },
      });
      expect(classifyDenial(res.status)).toBe("denied");
      expect(res.status).toBe(401);
    });

    it("denies unauthenticated DLQ retry", async () => {
      const res = await getRouteHandler(
        DlqRetryRoute,
        "POST",
      )({
        request: actorRequest(`/api/v1/admin/dlq/${deadLetterId}/retry`, "POST"),
        params: { id: deadLetterId },
      });
      expect(classifyDenial(res.status)).toBe("denied");
      expect(res.status).toBe(401);
    });

    it("denies unauthenticated jobs listing", async () => {
      const res = await getRouteHandler(
        JobsRoute,
        "GET",
      )({ request: actorRequest("/api/v1/admin/jobs/", "GET") });
      expect(classifyDenial(res.status)).toBe("denied");
      expect(res.status).toBe(401);
    });
  });

  describe("regular user admin access [control: admin-platform]", () => {
    it("denies Alice listing admin DLQ", async () => {
      const res = await getRouteHandler(
        DlqRoute,
        "GET",
      )({
        request: actorRequest("/api/v1/admin/dlq/", "GET", ALICE_ADDRESS),
      });
      expect(classifyDenial(res.status)).toBe("denied");
      expect(res.status).toBe(403);
    });

    it("denies Bob retrying admin DLQ items", async () => {
      const res = await getRouteHandler(
        DlqRetryRoute,
        "POST",
      )({
        request: actorRequest(`/api/v1/admin/dlq/${deadLetterId}/retry`, "POST", BOB_ADDRESS),
        params: { id: deadLetterId },
      });
      expect(classifyDenial(res.status)).toBe("denied");
      expect(res.status).toBe(403);
    });
  });

  describe("allowlisted administrator access [control: admin-platform]", () => {
    it("allows an allowlisted admin to list DLQ", async () => {
      const res = await getRouteHandler(
        DlqRoute,
        "GET",
      )({
        request: actorRequest("/api/v1/admin/dlq/", "GET", ADMIN_ADDRESS),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data.deadLetters)).toBe(true);
    });
  });
});
