import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const NULL_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const MINIFLARE_TEST_TIMEOUT_MS = 30_000;
const TEST_KEY = "P8xR0aS+0GBVOV4VXLnR/hNUBS8yADrMXjo1St6pL+0=";

let code: string;
let mf: Miniflare;

beforeAll(async () => {
  const result = await build({
    entryPoints: ["src/server/backup/worker.ts"],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    external: ["cloudflare:workers"],
    write: false,
    logLevel: "silent",
  });
  code = result.outputFiles[0].text;
});

beforeEach(() => {
  mf = new Miniflare({
    modules: true,
    script: code,
    compatibilityDate: "2025-09-24",
    compatibilityFlags: ["nodejs_compat"],
    durableObjects: { STEALTH_COORDINATOR: "StealthCoordinator" },
    kvNamespaces: { STEALTH_KV: "local-emulation-kv" },
    r2Buckets: { STEALTH_OBJECT_STORE: "local-emulation-r2" },
  });
});

afterEach(async () => {
  await mf.dispose();
});

async function seed(records: Array<{ key: string; value: unknown }>) {
  const ns: any = await mf.getDurableObjectNamespace("STEALTH_COORDINATOR");
  const stub = ns.get(ns.idFromName("global-stealth-coordinator"));
  await stub._debugSeed(records);
}

async function run(command: string, options: Record<string, unknown> = {}, archive?: unknown) {
  const res = await mf.dispatchFetch("http://localhost/backup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command, options: { key: TEST_KEY, ...options }, archive }),
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function seedAll() {
  await seed([
    {
      key: "user:id:u_1",
      value: {
        $v: 1,
        userId: "u_1",
        address: NULL_ADDRESS,
        email: "alice@example.com",
        username: "alice",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: 1,
      },
    },
    { key: "user:email:alice@example.com", value: "u_1" },
    { key: "user:username:alice", value: "u_1" },
    { key: `user:address:${NULL_ADDRESS}`, value: "u_1" },
    {
      key: "session:s_1",
      value: {
        $v: 1,
        sessionId: "s_1",
        userId: "u_1",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-02-01T00:00:00.000Z",
        lastActiveAt: "2026-01-01T00:00:00.000Z",
      },
    },
    {
      key: "policy:p_1",
      value: {
        $v: 1,
        policyId: "p_1",
        userId: "u_1",
        title: "Inbox rules",
        rules: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    },
    {
      key: "idempotency:op_1",
      value: {
        $v: 1,
        key: "op_1",
        operation: "send",
        status: "completed",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    },
  ]);
  const kv: any = await mf.getKVNamespace("STEALTH_KV");
  await kv.put(
    "sender-rule:sr_1",
    JSON.stringify({ ruleId: "sr_1", userId: "u_1", pattern: "spam" }),
  );
  await kv.put(
    "relay:message:msg_1",
    JSON.stringify({ messageId: "msg_1", recipient: "bob@example.com" }),
  );
  const r2: any = await mf.getR2Bucket("STEALTH_OBJECT_STORE");
  await r2.put("envelopes/m1/aaaa", new TextEncoder().encode("encrypted-envelope-bytes"));
}

describe("backup worker (local Cloudflare emulation)", () => {
  it(
    "rejects non-backup routes and missing commands",
    async () => {
      const missing = await mf.dispatchFetch("http://localhost/other");
      expect(missing.status).toBe(404);

      const bad = await mf.dispatchFetch("http://localhost/backup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(bad.status).toBe(400);
    },
    MINIFLARE_TEST_TIMEOUT_MS,
  );

  it(
    "creates an encrypted archive covering all three stores and verifies it",
    async () => {
      await seedAll();
      const { status, body } = await run("create");

      expect(status).toBe(200);
      expect(body.command).toBe("create");
      expect(body.ok).toBe(true);
      expect(body.archive.format).toBe("stealth-backup");
      expect(body.archive.encryption.cipher).toBe("AES-256-GCM");
      expect(body.stores.map((s: any) => s.store).sort()).toEqual(["durable-object", "kv", "r2"]);
      expect(body.stores.reduce((n: number, s: any) => n + s.count, 0)).toBe(10);

      const serialized = JSON.stringify(body.archive);
      expect(serialized).not.toContain("alice@example.com");
      expect(serialized).not.toContain("encrypted-envelope-bytes");
      expect(serialized).not.toContain("u_1");

      const verify = await run("verify", {}, body.archive);
      expect(verify.body.ok).toBe(true);
      expect(verify.body.verified).toBe(10);
    },
    MINIFLARE_TEST_TIMEOUT_MS,
  );

  it(
    "wipes, restores, and re-verifies without double side effects",
    async () => {
      await seedAll();
      const created = await run("create");
      const archive = created.body.archive;

      const restored = await run("restore", { wipeFirst: true }, archive);
      expect(restored.body.ok).toBe(true);
      expect(restored.body.restored).toBe(10);

      const ns: any = await mf.getDurableObjectNamespace("STEALTH_COORDINATOR");
      const stub = ns.get(ns.idFromName("global-stealth-coordinator"));
      const doKeys = await stub.listKeys("");
      expect(doKeys).toContain("user:id:u_1");
      expect(doKeys).toContain("idempotency:op_1");
      expect(doKeys).toContain("policy:p_1");

      const kv: any = await mf.getKVNamespace("STEALTH_KV");
      expect(await kv.get("relay:message:msg_1")).toBe(
        JSON.stringify({ messageId: "msg_1", recipient: "bob@example.com" }),
      );
      const r2: any = await mf.getR2Bucket("STEALTH_OBJECT_STORE");
      const obj = await r2.get("envelopes/m1/aaaa");
      expect(obj).not.toBeNull();
      expect(new TextDecoder().decode(await obj!.arrayBuffer())).toBe("encrypted-envelope-bytes");

      const verifyAfter = await run("verify", {}, archive);
      expect(verifyAfter.body.ok).toBe(true);
    },
    MINIFLARE_TEST_TIMEOUT_MS,
  );

  it(
    "list reports per-store key counts",
    async () => {
      await seedAll();
      const { body } = await run("list");
      expect(body.command).toBe("list");
      const doCount = body.stores.find((s: any) => s.store === "durable-object").keys;
      const kvCount = body.stores.find((s: any) => s.store === "kv").keys;
      const r2Count = body.stores.find((s: any) => s.store === "r2").keys;
      expect(doCount).toBe(7);
      expect(kvCount).toBe(2);
      expect(r2Count).toBe(1);
    },
    MINIFLARE_TEST_TIMEOUT_MS,
  );
});
