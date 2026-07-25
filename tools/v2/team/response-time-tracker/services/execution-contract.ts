import type { DateRange, ResponseTimeEntry, ResponseTimeMetrics, TeamMember } from "../types";
import { createResponseTimeService, type ResponseTimeServiceConfig } from "./response-time-service";

/**
 * Non-UI execution contract for the Response Time Tracker.
 *
 * `runResponseTimeQuery` is the stable backend-facing entry point for this tool:
 * it can be called from a script, a test, or a future server context without
 * importing React or any component. It never throws — every outcome, success or
 * failure, is represented in the returned `ResponseTimeQueryResult`. See
 * `docs/execution-contract.md` for the full contract and error code reference.
 */

/**
 * - `INVALID_DATE_RANGE`: the supplied `range` has a `start` after its `end`
 *   (or either bound fails to parse as a date). Returned before any fetch is
 *   attempted.
 * - `FETCH_FAILED`: the underlying data fetch rejected (e.g. a simulated
 *   failure via `ResponseTimeServiceConfig.failureRate`).
 */
export type ResponseTimeErrorCode = "INVALID_DATE_RANGE" | "FETCH_FAILED";

export interface ResponseTimeQueryInput {
  /** Optional date range filter. Omit to query the full fixture dataset. */
  range?: DateRange;
}

export interface ResponseTimeQueryData {
  entries: ResponseTimeEntry[];
  metrics: ResponseTimeMetrics;
  teamMembers: TeamMember[];
}

export interface ResponseTimeQueryError {
  code: ResponseTimeErrorCode;
  message: string;
}

export type ResponseTimeQueryResult =
  | { ok: true; data: ResponseTimeQueryData }
  | { ok: false; error: ResponseTimeQueryError };

function isValidRange(range: DateRange): boolean {
  const start = new Date(range.start).getTime();
  const end = new Date(range.end).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start <= end;
}

/**
 * Runs a single response-time query end to end (entries, team members, and
 * aggregate metrics) and returns a typed result. Non-UI callers should use this
 * instead of calling `createResponseTimeService` directly, so error handling
 * and input validation stay centralized in one place.
 */
export async function runResponseTimeQuery(
  input: ResponseTimeQueryInput = {},
  config: ResponseTimeServiceConfig = {},
): Promise<ResponseTimeQueryResult> {
  if (input.range && !isValidRange(input.range)) {
    return {
      ok: false,
      error: {
        code: "INVALID_DATE_RANGE",
        message: `Invalid date range: start (${input.range.start}) must not be after end (${input.range.end}).`,
      },
    };
  }

  const service = createResponseTimeService(config);

  try {
    const [entries, metrics, teamMembers] = await Promise.all([
      service.getEntries(input.range),
      service.getMetrics(input.range),
      service.getTeamMembers(),
    ]);

    return { ok: true, data: { entries, metrics, teamMembers } };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "FETCH_FAILED",
        message: err instanceof Error ? err.message : "Failed to load response time data.",
      },
    };
  }
}
