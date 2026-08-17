/**
 * timeline.service.ts — Client Thread Timeline (non-UI service entry point)
 *
 * Presentation-free service boundary for the timeline contract. Wraps the pure
 * `buildClientTimeline` / `getClientThread` helpers into a `TimelineContract`
 * whose `execute(...)` returns typed success/error results.
 */

import {
  TimelineErrorCode,
  type TimelineContract,
  type TimelineOperation,
  type TimelineContractOutput,
  type TimelineResult,
  buildClientTimeline,
  getClientThread,
  fail,
} from "../contract";

/**
 * Build the timeline execution contract.
 *
 * The service is pure: all state lives in the input messages, so it is fully
 * testable in isolation with no network, no secrets, and no UI.
 */
export function createTimelineContract(): TimelineContract {
  return {
    execute(input: TimelineOperation): TimelineResult<TimelineContractOutput> {
      try {
        switch (input.operation) {
          case "buildTimeline": {
            const timeline = buildClientTimeline(input.input, input.order ?? "asc");
            return { ok: true, value: { operation: "buildTimeline", timeline } };
          }
          case "getThread": {
            const thread = getClientThread(input.input);
            if (!thread) {
              return fail(
                TimelineErrorCode.NotFound,
                `No thread ${input.input.threadId} for client ${input.input.clientId}`,
              );
            }
            return { ok: true, value: { operation: "getThread", thread } };
          }
          default: {
            const _never: never = input;
            return fail(
              TimelineErrorCode.InvalidInput,
              `Unknown operation: ${JSON.stringify(_never)}`,
            );
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return fail(TimelineErrorCode.InvalidInput, message);
      }
    },
  };
}
