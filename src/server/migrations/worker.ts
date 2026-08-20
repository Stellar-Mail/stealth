import { DurableObject } from "cloudflare:workers";

import { createDurableObjectMigrationStorage } from "./durable-object-storage";
import { identityRecordFamilies, selectFamilies } from "./adapters";
import { dryRun, forward, integrityCheck, rollback } from "./runner";
import { MigrationCommand, MigrationReport, MigrationRunOptions } from "./types";

// ---------------------------------------------------------------------------
// BETA-024 (Issue #1931) — identity migration worker.
//
// This worker is NOT part of the public API surface. It is the deployable
// entrypoint for the schema-governance commands and is run either:
//   - locally via `bun run migrations:dry-run|forward|rollback|integrity-check`
//     (the CLI drives it with a Miniflare emulation of Cloudflare storage), or
//   - by pointing a tool at an equivalent route in a deployed environment.
//
// The DO instance it binds to shares its storage with the `StealthCoordinator`
// (same instance name `global-stealth-coordinator`), so migrations operate on
// exactly the records the API persists — never on a shadow copy.
// ---------------------------------------------------------------------------

const MIGRATION_INSTANCE = "global-stealth-coordinator";

export class StealthMigrationCoordinator extends DurableObject {
  async run(
    command: MigrationCommand,
    options: MigrationRunOptions = {},
  ): Promise<MigrationReport> {
    const storage = createDurableObjectMigrationStorage(this.ctx);
    const families = selectFamilies(identityRecordFamilies, options);
    switch (command) {
      case "dry-run":
        return dryRun(storage, families, options);
      case "forward":
        return forward(storage, families, options);
      case "rollback":
        return rollback(storage, families, options);
      case "integrity-check":
        return integrityCheck(storage, families, options);
      default:
        throw new Error(`Unknown migration command: ${String(command)}`);
    }
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

export default {
  async fetch(request: Request, env: { STEALTH_COORDINATOR: DurableObjectNamespace }) {
    const url = new URL(request.url);
    if (url.pathname !== "/migrate" || request.method !== "POST") {
      return new Response("not found", { status: 404 });
    }

    const body = (await request.json()) as {
      command?: MigrationCommand;
      options?: MigrationRunOptions;
    };
    if (!body.command) {
      return new Response("missing command", { status: 400 });
    }

    const id = env.STEALTH_COORDINATOR.idFromName(MIGRATION_INSTANCE);
    const stub = env.STEALTH_COORDINATOR.get(id);
    const report = await stub.run(body.command, body.options ?? {});
    return Response.json(report);
  },
};

export { StealthMigrationCoordinator as StealthCoordinator };
