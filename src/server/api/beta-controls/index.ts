import { loadRuntimeConfig } from "../../../config";
import { BetaControlService } from "./service";
import type { BetaControlConfig } from "../../../config/schema";
import { createBetaControlPersistence } from "./kv-persistence";

let singleton: BetaControlService | undefined;
let initialized = false;

/**
 * Reads the beta-control baseline from runtime config and constructs the service.
 * When the deployment exposes a shared KV binding, operator mutations are
 * persisted there so kill switches, flags, cohorts and invites remain
 * authoritative across workers and restarts (BETA-095). In tests this is
 * overridden via `setBetaControlServiceForTests`.
 */
export function createBetaControlService(config?: BetaControlConfig): BetaControlService {
  const full = loadRuntimeConfig();
  const resolved = config ?? full.betaControl;
  const persistence = createBetaControlPersistence(full.storage.kvBinding);
  return new BetaControlService({ config: resolved, persistence });
}

/**
 * Returns the process-wide BetaControlService, initializing it once with the
 * runtime config baseline (all kill switches open by default unless an operator
 * has closed them out-of-band, and fail-closed enforcement if the store is down).
 */
export function getBetaControlService(): BetaControlService {
  if (!singleton) {
    singleton = createBetaControlService();
  }
  return singleton;
}

/** Initializes the singleton (loads persisted snapshot if a persistence adapter is wired). */
export async function initBetaControlService(): Promise<BetaControlService> {
  const svc = getBetaControlService();
  if (!initialized) {
    await svc.init();
    initialized = true;
  }
  return svc;
}

/** Test-only: replace the singleton (e.g. with a seeded in-memory service). */
export function setBetaControlServiceForTests(service: BetaControlService | undefined): void {
  singleton = service;
  initialized = service === undefined;
}

export type { BetaControlService } from "./service";
export * from "./types";
export { enforceCapability } from "./guard";
