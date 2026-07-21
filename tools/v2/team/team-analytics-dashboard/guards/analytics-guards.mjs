import { AnalyticsError, AnalyticsErrorCode } from "./analytics-errors.mjs";

const MAX_MEMBERS = 500;
const MAX_SOURCE_REPORTS = 1000;

export function validateDashboardData(data) {
  if (!data || typeof data !== "object") {
    throw new AnalyticsError(
      AnalyticsErrorCode.INVALID_DASHBOARD_DATA,
      "Dashboard data must be an object",
    );
  }

  if (!Array.isArray(data.members)) {
    throw new AnalyticsError(AnalyticsErrorCode.INVALID_MEMBERS, "data.members must be an array");
  }

  if (data.members.length > MAX_MEMBERS) {
    throw new AnalyticsError(
      AnalyticsErrorCode.MEMBERS_LIMIT_EXCEEDED,
      "data.members exceeds the maximum allowed length of " + MAX_MEMBERS,
    );
  }

  for (const member of data.members) {
    if (!member || typeof member !== "object") {
      throw new AnalyticsError(
        AnalyticsErrorCode.INVALID_MEMBER_ITEM,
        "Member items must be objects",
      );
    }
    if (typeof member.memberId !== "string") {
      throw new AnalyticsError(AnalyticsErrorCode.INVALID_MEMBER_ID, "memberId must be a string");
    }
  }
}

export function validateSourceReports(sourceReports) {
  if (!Array.isArray(sourceReports)) {
    throw new AnalyticsError(
      AnalyticsErrorCode.INVALID_SOURCE_REPORTS,
      "sourceReports must be an array",
    );
  }

  if (sourceReports.length > MAX_SOURCE_REPORTS) {
    throw new AnalyticsError(
      AnalyticsErrorCode.SOURCE_REPORTS_LIMIT_EXCEEDED,
      "sourceReports exceeds the maximum allowed length of " + MAX_SOURCE_REPORTS,
    );
  }

  for (const report of sourceReports) {
    if (!report || typeof report !== "object") {
      throw new AnalyticsError(
        AnalyticsErrorCode.INVALID_SOURCE_REPORT_ITEM,
        "Source report items must be objects",
      );
    }
  }
}
