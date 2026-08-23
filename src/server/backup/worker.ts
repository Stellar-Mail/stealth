import { DurableObject } from "cloudflare:workers";

import { createBackup, restoreBackup, verifyBackup } from "./engine";
import {
  createDurableObjectBackupStorage,
  createKvBackupStorage,
  createR2BackupStorage,
} from "./storage";
import type {
  BackupArchive,
  BackupCommand,
  BackupRunOptions,
  BackupStorage,
  BackupStoredValue,
} from "./types";

// ---------------------------------------------------------------------------
// BETA-081 (Issue #1988) — encrypted backup worker.
//
// This worker is NOT part of the public API surface. It is the deployable
// entrypoint for the backup commands (create / verify / restore) and is run
// either:
//   - locally via `node scripts/backup/backup.mjs <command>` (the CLI drives
//     it with a Miniflare emulation of Cloudflare storage), or
//   - by pointing an equivalent route at the deployed environment.
//
// The DO instance it binds to shares its storage with the `StealthCoordinator`
// (same instance name `global-stealth-coordinator`), so backups capture exactly
// the records the API persists — never a shadow copy. KV and R2 are read via
// their direct bindings.
// ---------------------------------------------------------------------------

const BACKUP_INSTANCE = "global-stealth-coordinator";

interface BackupEnv {
  STEALTH_COORDINATOR: DurableObjectNamespace;
  STEALTH_KV: KVNamespace;
  STEALTH_OBJECT_STORE: R2Bucket;
  STEALTH_BACKUP_KEY?: string;
}

/** Adapter over the DO stub RPCs (listKeys/get/put/delete) — shares the
 * coordinator's storage, exactly like the migrations worker. */
function createStubDurableObjectBackupStorage(
  stub: InstanceType<typeof StealthBackupCoordinator>,
): BackupStorage {
  return {
    store: "durable-object",
    async listKeys(prefix = ""): Promise<string[]> {
      return stub.listKeys(prefix);
    },
    async get(key: string): Promise<BackupStoredValue | null> {
      return stub.get(key);
    },
    async put(key: string, value: BackupStoredValue): Promise<void> {
      await stub.put(key, value);
    },
    async delete(key: string): Promise<void> {
      await stub.delete(key);
    },
  };
}

export class StealthBackupCoordinator extends DurableObject {
  async listKeys(prefix: string): Promise<string[]> {
    return createDurableObjectBackupStorage(this.ctx).listKeys(prefix);
  }

  async get(key: string): Promise<BackupStoredValue | null> {
    return createDurableObjectBackupStorage(this.ctx).get(key);
  }

  async put(key: string, value: BackupStoredValue): Promise<void> {
    await this.ctx.storage.put(key, JSON.parse(new TextDecoder().decode(value.bytes)));
  }

  async delete(key: string): Promise<void> {
    await this.ctx.storage.delete(key);
  }

  /**
   * Test-only record seeding for the local Cloudflare emulation tests. This is
   * a direct RPC on the DO stub and is NOT reachable through the fetch handler,
   * so it cannot be triggered over HTTP in any deployed environment.
   */
  async _debugSeed(records: Array<{ key: string; value: unknown }>): Promise<number> {
    for (const { key, value } of records) {
      await this.ctx.storage.put(key, value);
    }
    return records.length;
  }
}

function backupKey(env: BackupEnv, options: BackupRunOptions): string {
  const key = options.key ?? env.STEALTH_BACKUP_KEY;
  if (!key) {
    throw new Error("STEALTH_BACKUP_KEY is required (or pass --key with a base64 32-byte secret)");
  }
  return key;
}

export default {
  async fetch(request: Request, env: BackupEnv) {
    const url = new URL(request.url);
    if (url.pathname !== "/backup" || request.method !== "POST") {
      return new Response("not found", { status: 404 });
    }

    const body = (await request.json()) as {
      command?: BackupCommand;
      options?: BackupRunOptions;
      archive?: BackupArchive;
    };
    if (!body.command) {
      return new Response("missing command", { status: 400 });
    }

    const id = env.STEALTH_COORDINATOR.idFromName(BACKUP_INSTANCE);
    const stub = env.STEALTH_COORDINATOR.get(id);
    const options = body.options ?? {};

    const storages: BackupStorage[] = [
      createStubDurableObjectBackupStorage(stub),
      createKvBackupStorage(env.STEALTH_KV),
      createR2BackupStorage(env.STEALTH_OBJECT_STORE),
    ];

    switch (body.command) {
      case "create": {
        const report = await createBackup(storages, backupKey(env, options), options);
        return Response.json(report);
      }
      case "verify": {
        if (!body.archive) return new Response("missing archive", { status: 400 });
        const report = await verifyBackup(body.archive, backupKey(env, options));
        return Response.json(report);
      }
      case "restore": {
        if (!body.archive) return new Response("missing archive", { status: 400 });
        const report = await restoreBackup(
          body.archive,
          backupKey(env, options),
          storages,
          options,
        );
        return Response.json(report);
      }
      case "list": {
        const list = await Promise.all(
          storages.map(async (storage) => ({
            store: storage.store,
            keys: (await storage.listKeys()).length,
          })),
        );
        return Response.json({
          command: "list",
          generatedAt: new Date().toISOString(),
          stores: list,
        });
      }
      case "rehearsal":
        return new Response("run rehearsal via the CLI", { status: 400 });
      default:
        return new Response("unknown command", { status: 400 });
    }
  },
};

export { StealthBackupCoordinator as StealthCoordinator };
