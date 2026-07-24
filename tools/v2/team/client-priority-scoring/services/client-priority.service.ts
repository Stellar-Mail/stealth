/**
 * client-priority.service.ts — Client Priority Scoring (non-UI service)
 *
 * Presentation-free service boundary for the priority contract. Wraps the pure
 * `scoreClients` reducer into a `PriorityContract` whose `execute(...)` returns
 * typed success/error results.
 */

import {
  PriorityErrorCode,
  ok,
  type PriorityContract,
  type PriorityOperation,
  type PriorityContractOutput,
  type PriorityResult,
  scoreClients,
  validateScoreInput,
  fail,
} from "../contract";

/** Build the priority scoring execution contract. */
export function createPriorityContract(): PriorityContract {
  return {
    execute(input: PriorityOperation): PriorityResult<PriorityContractOutput> {
      try {
        const err = validateScoreInput(input.input);
        if (err) return fail(PriorityErrorCode.InvalidInput, err);
        const ranked = scoreClients(input.input, input.order ?? "desc");
        return ok({ operation: "score", ranked });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return fail(PriorityErrorCode.InvalidInput, message);
      }
    },
  };
}
