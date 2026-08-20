import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const NULL_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const MINIFLARE_TEST_TIMEOUT_MS = 30_000;

let code: string;
let mf: Miniflare;

beforeAll(async () => {
  const result = await build({
    entryPoints: ["src/server/migrations/worker.ts"],
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

async function run(command: string, options: Record<string, unknown> = {}) {
  const res = await mf.dispatchFetch("http://localhost/migrate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command, options }),
  });
  return { status: res.status, body: (await res.json()) as any };
}

function seedIdentityRecords(extra: Array<{ key: string; value: unknown }> = []) {
  return seed([
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
    ...extra,
  ]);
}

describe("identity migration worker (local Cloudflare emulation)", () => {
  it(
    "rejects non-migration routes and missing commands",
    async () => {
      const missing = await mf.dispatchFetch("http://localhost/other");
      expect(missing.status).toBe(404);

      const bad = await mf.dispatchFetch("http://localhost/migrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(bad.status).toBe(400);
    },
    MINIFLARE_TEST_TIMEOUT_MS,
  );

  it(
    "runs dry-run against the emulated Durable Object storage",
    async () => {
      await seedIdentityRecords();
      const { status, body } = await run("dry-run");

      expect(status).toBe(200);
      expect(body.command).toBe("dry-run");
      const user = body.families.find((f: any) => f.family === "user");
      const session = body.families.find((f: any) => f.family === "session");
      expect(user.totalKeys).toBe(1);
      expect(user.forwardPending).toBe(0);
      expect(session.totalKeys).toBe(1);
      expect(body.ok).toBe(true);
    },
    MINIFLARE_TEST_TIMEOUT_MS,
  );

  it(
    "detects dangling and mismatched indexes during integrity-check",
    async () => {
      await seedIdentityRecords([
        { key: "user:username:ghost", value: "u_missing" },
        { key: "user:email:alice@example.com", value: "someone-else" },
      ]);
      const { status, body } = await run("integrity-check");

      expect(status).toBe(200);
      expect(body.ok).toBe(false);

      const user = body.families.find((f: any) => f.family === "user");
      const username = body.families.find((f: any) => f.family === "username");

      expect(user.issues.map((i: any) => i.kind)).toContain("index_mismatch");
      expect(username.issues.map((i: any) => i.kind)).toContain("dangling_index");

      // Redaction: full index values never appear in the report.
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("ghost");
      expect(serialized).not.toContain("alice@example.com");
    },
    MINIFLARE_TEST_TIMEOUT_MS,
  );

  it(
    "reports unsupported schema versions as failures without mutating data",
    async () => {
      await seedIdentityRecords([
        { key: "user:id:u_future", value: { $v: 99, userId: "u_future" } },
      ]);
      const { body } = await run("dry-run");

      const user = body.families.find((f: any) => f.family === "user");
      expect(user.failed).toBe(1);
      expect(user.errors[0]).toContain("unsupported schema version 99");
      expect(body.ok).toBe(false);
    },
    MINIFLARE_TEST_TIMEOUT_MS,
  );

  it(
    "forward is idempotent when every family is already current",
    async () => {
      await seedIdentityRecords();
      const { status, body } = await run("forward");

      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      const user = body.families.find((f: any) => f.family === "user");
      const session = body.families.find((f: any) => f.family === "session");
      expect(user.changed).toBe(0);
      expect(session.changed).toBe(0);
      expect(user.skipped).toBe(1);
      expect(session.skipped).toBe(1);
    },
    MINIFLARE_TEST_TIMEOUT_MS,
  );

  it(
    "rollback without a target version is rejected by the runner",
    async () => {
      await seedIdentityRecords();
      const { body } = await run("rollback");
      expect(body.ok).toBe(false);
      expect(body.families[0].errors[0]).toContain("--target-version");
    },
    MINIFLARE_TEST_TIMEOUT_MS,
  );
});
