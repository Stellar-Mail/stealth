/**
 * Stable, machine-readable error codes for the team-analytics-dashboard
 * execution contract.
 *
 * Non-UI callers (schedulers, snapshot jobs, other services) can branch on
 * `error.code` instead of parsing human-readable messages, which keeps the
 * contract stable even if the wording of a message changes.
 */
export const AnalyticsErrorCode = Object.freeze({
  INVALID_DASHBOARD_DATA: "INVALID_DASHBOARD_DATA",
  INVALID_MEMBERS: "INVALID_MEMBERS",
  MEMBERS_LIMIT_EXCEEDED: "MEMBERS_LIMIT_EXCEEDED",
  INVALID_MEMBER_ITEM: "INVALID_MEMBER_ITEM",
  INVALID_MEMBER_ID: "INVALID_MEMBER_ID",
  INVALID_SOURCE_REPORTS: "INVALID_SOURCE_REPORTS",
  SOURCE_REPORTS_LIMIT_EXCEEDED: "SOURCE_REPORTS_LIMIT_EXCEEDED",
  INVALID_SOURCE_REPORT_ITEM: "INVALID_SOURCE_REPORT_ITEM",
});

/**
 * Error raised by the analytics guards when an input payload violates the
 * execution contract. Always carries a `code` from `AnalyticsErrorCode`.
 */
export class AnalyticsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AnalyticsError";
    this.code = code;
  }
}
