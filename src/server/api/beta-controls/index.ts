import { loadRuntimeConfig } from "../../../config";
import { BetaControlService } from "./service";
import type { BetaControlConfig } from "../../../config/schema";

let singleton: BetaControlService | undefined;
let initialized = false;

/**
 * Reads the beta-control baseline from runtime config and constructs the service.
 * In tests this is overridden via `setBetaControlServiceForTests`.
 */
export function createBetaControlService(config?: BetaControlConfig): BetaControlService {
  const resolved = config ?? loadRuntimeConfig().betaControl;
  return new BetaControlService({ config: resolved });
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
