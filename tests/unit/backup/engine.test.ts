import { describe, expect, it } from "vitest";

import { createBackup, restoreBackup, verifyBackup } from "@/server/backup/engine";
import { createMemoryBackupStorage } from "@/server/backup/storage";

const TEST_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

function enc(value: unknown): Uint8Array {
  return new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
}

describe("backup engine", () => {
  it("round-trips durable-object, kv, and r2 stores through create → restore", async () => {
    const doStore = createMemoryBackupStorage("durable-object");
    const kvStore = createMemoryBackupStorage("kv");
    const r2Store = createMemoryBackupStorage("r2");

    await doStore.put("user:id:u_1", {
      encoding: "json",
      bytes: enc({ userId: "u_1", email: "alice@example.com" }),
    });
    await doStore.put("idempotency:op_1", {
      encoding: "json",
      bytes: enc({ status: "completed" }),
    });
    await kvStore.put("policy:p_1", { encoding: "text", bytes: enc("policy-json") });
    await r2Store.put("envelopes/m1/aaaa", { encoding: "bytes", bytes: enc("encrypted-envelope") });

    const created = await createBackup([doStore, kvStore, r2Store], TEST_KEY);
    expect(created.ok).toBe(true);
    expect(created.stores.map((s) => s.store).sort()).toEqual(["durable-object", "kv", "r2"]);

    const verifyBefore = await verifyBackup(created.archive!, TEST_KEY);
    expect(verifyBefore.ok).toBe(true);
    expect(verifyBefore.verified).toBe(4);

    const wipe = createMemoryBackupStorage("durable-object");
    const wipedKv = createMemoryBackupStorage("kv");
    const wipedR2 = createMemoryBackupStorage("r2");

    const restored = await restoreBackup(created.archive!, TEST_KEY, [wipe, wipedKv, wipedR2]);
    expect(restored.ok).toBe(true);
    expect(restored.restored).toBe(4);

    expect(await doStore.listKeys()).toEqual(await wipe.listKeys());
    expect(await kvStore.get("policy:p_1")).toEqual(await wipedKv.get("policy:p_1"));
    expect(await r2Store.get("envelopes/m1/aaaa")).toEqual(await wipedR2.get("envelopes/m1/aaaa"));
  });

  it("restore preserves idempotency keys verbatim (no double side effects)", async () => {
    const doStore = createMemoryBackupStorage("durable-object");
    const idemKey = "idempotency:send-abc";
    await doStore.put(idemKey, {
      encoding: "json",
      bytes: enc({ status: "completed", idempotencyKey: "send-abc" }),
    });

    const created = await createBackup([doStore], TEST_KEY);
    const target = createMemoryBackupStorage("durable-object");
    await restoreBackup(created.archive!, TEST_KEY, [target]);

    const value = await target.get(idemKey);
    expect(value).not.toBeNull();
    expect(JSON.parse(new TextDecoder().decode(value!.bytes)).idempotencyKey).toBe("send-abc");
  });

  it("never emits plaintext keys, emails, seeds, or mail in reports or headers", async () => {
    const doStore = createMemoryBackupStorage("durable-object");
    await doStore.put("user:email:alice@example.com", { encoding: "json", bytes: enc("u_1") });
    await doStore.put("wallet:metadata:w_1", {
      encoding: "json",
      bytes: enc({ seed: "SECRET-SEED-VALUE" }),
    });
    await doStore.put("envelope:e_1", { encoding: "json", bytes: enc("PLAINTEXT-MAIL-BODY") });

    const created = await createBackup([doStore], TEST_KEY);
    const serializedArchive = JSON.stringify(created.archive);
    const verify = await verifyBackup(created.archive!, TEST_KEY);
    const serializedReport = JSON.stringify(verify);

    expect(serializedArchive).not.toContain("alice@example.com");
    expect(serializedArchive).not.toContain("SECRET-SEED-VALUE");
    expect(serializedArchive).not.toContain("PLAINTEXT-MAIL-BODY");
    expect(serializedReport).not.toContain("alice@example.com");
    expect(serializedReport).not.toContain("SECRET-SEED-VALUE");
  });

  it("fails closed on a tampered archive", async () => {
    const doStore = createMemoryBackupStorage("durable-object");
    await doStore.put("user:id:u_1", { encoding: "json", bytes: enc({ userId: "u_1" }) });

    const created = await createBackup([doStore], TEST_KEY);
    const tampered = {
      ...created.archive!,
      ciphertext: "AAAA" + created.archive!.ciphertext.slice(4),
    };

    const verify = await verifyBackup(tampered, TEST_KEY);
    expect(verify.ok).toBe(false);
    expect(verify.errors[0]).toContain("authentication failed");

    const target = createMemoryBackupStorage("durable-object");
    const restore = await restoreBackup(tampered, TEST_KEY, [target]);
    expect(restore.ok).toBe(false);
    expect(await target.listKeys()).toEqual([]);
  });

  it("fails closed on a wrong key", async () => {
    const doStore = createMemoryBackupStorage("durable-object");
    await doStore.put("user:id:u_1", { encoding: "json", bytes: enc({ userId: "u_1" }) });

    const created = await createBackup([doStore], TEST_KEY);
    const wrongKey = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=";
    const verify = await verifyBackup(created.archive!, wrongKey);
    expect(verify.ok).toBe(false);
  });

  it("restores in documented order: identity before policy before relay before r2", async () => {
    const order: string[] = [];
    const trackingStore = createMemoryBackupStorage("durable-object");
    const originalPut = trackingStore.put.bind(trackingStore);
    trackingStore.put = async (key, value) => {
      order.push(key);
      await originalPut(key, value);
    };

    await trackingStore.put("user:id:u_1", { encoding: "json", bytes: enc({ userId: "u_1" }) });
    await trackingStore.put("policy:p_1", { encoding: "json", bytes: enc({ policyId: "p_1" }) });
    await trackingStore.put("relay:message:m_1", {
      encoding: "json",
      bytes: enc({ messageId: "m_1" }),
    });
    await trackingStore.put("idempotency:op_1", {
      encoding: "json",
      bytes: enc({ status: "done" }),
    });

    const created = await createBackup([trackingStore], TEST_KEY);
    const target = createMemoryBackupStorage("durable-object");
    await restoreBackup(created.archive!, TEST_KEY, [target]);

    expect(order.indexOf("user:id:u_1")).toBeLessThan(order.indexOf("policy:p_1"));
    expect(order.indexOf("policy:p_1")).toBeLessThan(order.indexOf("relay:message:m_1"));
    expect(order.indexOf("relay:message:m_1")).toBeLessThan(order.indexOf("idempotency:op_1"));
  });
});
