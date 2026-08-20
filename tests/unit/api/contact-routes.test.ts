import { beforeEach, describe, expect, it } from "vitest";

import { Route as ContactsIndexRoute } from "../../../src/routes/api/v1/contacts/index";
import { Route as ContactRoute } from "../../../src/routes/api/v1/contacts/$contactId";
import { Route as MergeRoute } from "../../../src/routes/api/v1/contacts/merge";
import { Route as ImportPreviewRoute } from "../../../src/routes/api/v1/contacts/import/preview";
import { Route as ImportCommitRoute } from "../../../src/routes/api/v1/contacts/import/commit";
import { ACTOR_HEADER } from "../../../src/server/api/actor";
import { listContacts } from "../../../src/server/api/contact-service";
import { getApiContext } from "../../../src/server/api/context";
import type { MemoryApiRepository } from "../../../src/server/api/memory-repository";

const owner = `G${"A".repeat(55)}`;
const otherOwner = `G${"B".repeat(55)}`;

const VALID_G = `G${"C".repeat(55)}`;

const listHandler = (ContactsIndexRoute.options as any).server?.handlers?.GET;
const createHandler = (ContactsIndexRoute.options as any).server?.handlers?.POST;
const getHandler = (ContactRoute.options as any).server?.handlers?.GET;
const putHandler = (ContactRoute.options as any).server?.handlers?.PUT;
const deleteHandler = (ContactRoute.options as any).server?.handlers?.DELETE;
const mergeHandler = (MergeRoute.options as any).server?.handlers?.POST;
const previewHandler = (ImportPreviewRoute.options as any).server?.handlers?.POST;
const commitHandler = (ImportCommitRoute.options as any).server?.handlers?.POST;

function request(path: string, method: string, actor?: string, body?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (actor !== undefined) headers[ACTOR_HEADER] = actor;
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`https://stealth.test${path}`, init);
}

describe("contacts route actor authorization (BETA-066 / Issue #1973)", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  it("rejects anonymous and invalid principals on every mutating route", async () => {
    const cases: Array<{ label: string; handler: (arg: any) => Promise<Response>; args: any }> = [
      {
        label: "POST /contacts",
        handler: createHandler,
        args: {
          request: request("/api/v1/contacts", "POST", undefined, { name: "A", address: VALID_G }),
        },
      },
      {
        label: "PUT /contacts/:id",
        handler: putHandler,
        args: {
          request: request("/api/v1/contacts/c_1", "PUT", undefined, { name: "B" }),
          params: { contactId: "c_1" },
        },
      },
      {
        label: "DELETE /contacts/:id",
        handler: deleteHandler,
        args: { request: request("/api/v1/contacts/c_1", "DELETE"), params: { contactId: "c_1" } },
      },
      {
        label: "POST /contacts/merge",
        handler: mergeHandler,
        args: {
          request: request("/api/v1/contacts/merge", "POST", undefined, {
            keepContactId: "c_1",
            mergeContactIds: ["c_2"],
          }),
        },
      },
      {
        label: "POST /contacts/import/preview",
        handler: previewHandler,
        args: {
          request: request("/api/v1/contacts/import/preview", "POST", undefined, {
            format: "csv",
            content: "A,a",
          }),
        },
      },
      {
        label: "POST /contacts/import/commit",
        handler: commitHandler,
        args: {
          request: request("/api/v1/contacts/import/commit", "POST", undefined, {
            rows: [{ name: "A", address: VALID_G }],
          }),
        },
      },
    ];

    for (const { label, handler, args } of cases) {
      const response = await handler(args);
      expect(response.status, label).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
    }
  });

  it("scopes all routes to the authenticated actor's own contact set", async () => {
    const createA = await createHandler({
      request: request("/api/v1/contacts", "POST", owner, { name: "Mine", address: VALID_G }),
    });
    expect(createA.status).toBe(201);

    const listOther = await listHandler({
      request: request("/api/v1/contacts", "GET", otherOwner),
    });
    expect(listOther.status).toBe(200);
    const otherData = await listOther.json();
    expect(otherData.data.items).toHaveLength(0);

    const listMine = await listHandler({ request: request("/api/v1/contacts", "GET", owner) });
    expect(listMine.status).toBe(200);
    const mineData = await listMine.json();
    expect(mineData.data.items).toHaveLength(1);
    expect(mineData.data.items[0].contact.address).toBe(VALID_G);
  });

  it("cannot read or delete another actor's contact", async () => {
    const created = await createHandler({
      request: request("/api/v1/contacts", "POST", owner, { name: "Mine", address: VALID_G }),
    });
    const { contact } = (await created.json()).data;

    const forbiddenGet = await getHandler({
      request: request(`/api/v1/contacts/${contact.contactId}`, "GET", otherOwner),
      params: { contactId: contact.contactId },
    });
    expect(forbiddenGet.status).toBe(404);

    const forbiddenDelete = await deleteHandler({
      request: request(`/api/v1/contacts/${contact.contactId}`, "DELETE", otherOwner),
      params: { contactId: contact.contactId },
    });
    expect(forbiddenDelete.status).toBe(404);

    const stillThere = await listHandler({ request: request("/api/v1/contacts", "GET", owner) });
    expect((await stillThere.json()).data.items).toHaveLength(1);
  });

  it("performs full CRUD round-trip for the owner", async () => {
    const created = await createHandler({
      request: request("/api/v1/contacts", "POST", owner, { name: "Alice", address: VALID_G }),
    });
    expect(created.status).toBe(201);
    const { contact } = (await created.json()).data;
    expect(contact.contactId).toMatch(/^c_/);

    const fetched = await getHandler({
      request: request(`/api/v1/contacts/${contact.contactId}`, "GET", owner),
      params: { contactId: contact.contactId },
    });
    expect(fetched.status).toBe(200);
    expect((await fetched.json()).data.contact.name).toBe("Alice");

    const updated = await putHandler({
      request: request(`/api/v1/contacts/${contact.contactId}`, "PUT", owner, {
        name: "Alice Updated",
        trust: "allow",
      }),
      params: { contactId: contact.contactId },
    });
    expect(updated.status).toBe(200);
    const updatedData = await updated.json();
    expect(updatedData.data.contact.name).toBe("Alice Updated");
    expect(updatedData.data.contact.version).toBe(2);

    const deleted = await deleteHandler({
      request: request(`/api/v1/contacts/${contact.contactId}`, "DELETE", owner),
      params: { contactId: contact.contactId },
    });
    expect(deleted.status).toBe(200);
  });

  it("merge validates ownership of both sides", async () => {
    const keep = await createHandler({
      request: request("/api/v1/contacts", "POST", owner, { name: "Keep", address: VALID_G }),
    });
    const dup = await createHandler({
      request: request("/api/v1/contacts", "POST", owner, {
        name: "Dup",
        address: `S${"D".repeat(55)}`,
      }),
    });
    const keepData = (await keep.json()).data.contact;
    const dupData = (await dup.json()).data.contact;

    const merged = await mergeHandler({
      request: request("/api/v1/contacts/merge", "POST", owner, {
        keepContactId: keepData.contactId,
        mergeContactIds: [dupData.contactId],
      }),
    });
    expect(merged.status).toBe(200);
    expect((await merged.json()).data.contact.contactId).toBe(keepData.contactId);

    const page = await listContacts(repo, owner);
    expect(page.items).toHaveLength(1);
  });

  it("import preview and commit round-trip for the owner", async () => {
    const preview = await previewHandler({
      request: request("/api/v1/contacts/import/preview", "POST", owner, {
        format: "csv",
        content: `Alice,${VALID_G}\nBob,g*bob`,
      }),
    });
    expect(preview.status).toBe(200);
    const previewData = (await preview.json()).data;
    expect(previewData.totalRows).toBe(2);
    expect(previewData.validRows).toBeGreaterThanOrEqual(1);

    const commit = await commitHandler({
      request: request("/api/v1/contacts/import/commit", "POST", owner, {
        rows: [{ name: "Alice", address: VALID_G, source: "csv" }],
      }),
    });
    expect(commit.status).toBe(201);
    const commitData = (await commit.json()).data;
    expect(commitData.created).toBe(1);
    expect(commitData.appliedRules).toBe(0);
  });

  it("commit without applyTrust never touches sender rules", async () => {
    const commit = await commitHandler({
      request: request("/api/v1/contacts/import/commit", "POST", owner, {
        rows: [{ name: "Blocked", address: VALID_G, trust: "block" }],
      }),
    });
    expect(commit.status).toBe(201);
    expect((await commit.json()).data.appliedRules).toBe(0);
  });
});
