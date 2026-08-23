import { beforeEach, describe, expect, it } from "vitest";

import { Route as DraftsIndexRoute } from "@/routes/api/v1/drafts/index";
import { Route as DraftRoute } from "@/routes/api/v1/drafts/$draftId";
import { ACTOR_HEADER } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import type { MemoryApiRepository } from "@/server/api/memory-repository";

const owner = `G${"A".repeat(55)}`;
const otherOwner = `G${"B".repeat(55)}`;

const listHandler = (DraftsIndexRoute.options as any).server?.handlers?.GET;
const createHandler = (DraftsIndexRoute.options as any).server?.handlers?.POST;
const getHandler = (DraftRoute.options as any).server?.handlers?.GET;
const putHandler = (DraftRoute.options as any).server?.handlers?.PUT;
const deleteHandler = (DraftRoute.options as any).server?.handlers?.DELETE;

function request(path: string, method: string, actor?: string, body?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (actor !== undefined) headers[ACTOR_HEADER] = actor;
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`https://stealth.test${path}`, init);
}

describe("drafts route actor authorization & CRUD (BETA-058 / Issue #1965)", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  it("rejects anonymous requests with 401 on every route", async () => {
    const cases = [
      {
        label: "GET /drafts",
        handler: listHandler,
        args: { request: request("/api/v1/drafts", "GET") },
      },
      {
        label: "POST /drafts",
        handler: createHandler,
        args: { request: request("/api/v1/drafts", "POST", undefined, { subject: "Test" }) },
      },
      {
        label: "GET /drafts/:id",
        handler: getHandler,
        args: { request: request("/api/v1/drafts/d_1", "GET"), params: { draftId: "d_1" } },
      },
      {
        label: "PUT /drafts/:id",
        handler: putHandler,
        args: {
          request: request("/api/v1/drafts/d_1", "PUT", undefined, {
            subject: "Update",
            expectedVersion: 1,
          }),
          params: { draftId: "d_1" },
        },
      },
      {
        label: "DELETE /drafts/:id",
        handler: deleteHandler,
        args: { request: request("/api/v1/drafts/d_1", "DELETE"), params: { draftId: "d_1" } },
      },
    ];

    for (const { label, handler, args } of cases) {
      const response = await handler(args);
      expect(response.status, label).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
    }
  });

  it("creates, retrieves, updates with version check, and deletes a draft end-to-end", async () => {
    // 1. Create draft
    const createRes = await createHandler({
      request: request("/api/v1/drafts", "POST", owner, {
        to: ["bob@stealth.xyz"],
        subject: "Draft Title",
        body: "Draft Body",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()).data;
    expect(created.draftId).toBeDefined();
    expect(created.version).toBe(1);
    expect(created.subject).toBe("Draft Title");

    // 2. Get draft
    const getRes = await getHandler({
      request: request(`/api/v1/drafts/${created.draftId}`, "GET", owner),
      params: { draftId: created.draftId },
    });
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()).data;
    expect(fetched.subject).toBe("Draft Title");

    // 3. Update draft
    const putRes = await putHandler({
      request: request(`/api/v1/drafts/${created.draftId}`, "PUT", owner, {
        subject: "Updated Title",
        expectedVersion: 1,
      }),
      params: { draftId: created.draftId },
    });
    expect(putRes.status).toBe(200);
    const updated = (await putRes.json()).data;
    expect(updated.version).toBe(2);
    expect(updated.subject).toBe("Updated Title");

    // 4. Stale update returns 409 conflict
    const stalePutRes = await putHandler({
      request: request(`/api/v1/drafts/${created.draftId}`, "PUT", owner, {
        subject: "Stale Edit",
        expectedVersion: 1,
      }),
      params: { draftId: created.draftId },
    });
    expect(stalePutRes.status).toBe(409);
    const conflictBody = await stalePutRes.json();
    expect(conflictBody.error.code).toBe("conflict");
    expect(conflictBody.error.details.current.version).toBe(2);

    // 5. Delete draft
    const delRes = await deleteHandler({
      request: request(`/api/v1/drafts/${created.draftId}`, "DELETE", owner),
      params: { draftId: created.draftId },
    });
    expect(delRes.status).toBe(200);

    // 6. Verify not found
    const getAfterDel = await getHandler({
      request: request(`/api/v1/drafts/${created.draftId}`, "GET", owner),
      params: { draftId: created.draftId },
    });
    expect(getAfterDel.status).toBe(404);
  });
});
