/**
 * services/execution.service.ts — Audit Log Viewer
 *
 * Wraps the pure `applyAuditOperation` reducer with real state and network
 * simulation. This is the concrete `AuditContract` implementation that
 * backend callers construct and use.
 */

import type { AuditLogEntry } from "../types";
import type { AuditContract, AuditOperation, AuditContractOutput, AuditResult } from "../contract";
import { applyAuditOperation } from "../contract";
import { mockAuditEntries, MOCK_NETWORK_DELAY_MS } from "../fixtures/auditFixtures";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates an `AuditContract` instance backed by an in-memory store seeded
 * from fixtures. Read-only: no operation mutates the underlying entries.
 */
export function createAuditLogContract(
  seed: AuditLogEntry[] = mockAuditEntries,
  networkDelayMs: number = MOCK_NETWORK_DELAY_MS,
): AuditContract {
  const store = new Map<string, AuditLogEntry>(seed.map((entry) => [entry.id, entry]));

  return {
    async execute(op: AuditOperation): Promise<AuditResult<AuditContractOutput>> {
      if (networkDelayMs > 0) await delay(networkDelayMs);
      return applyAuditOperation(store, op);
    },
  };
}
