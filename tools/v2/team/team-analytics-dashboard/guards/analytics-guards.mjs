const MAX_MEMBERS = 500;
const MAX_SOURCE_REPORTS = 1000;

export function validateDashboardData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Dashboard data must be an object");
  }

  if (!Array.isArray(data.members)) {
    throw new Error("data.members must be an array");
  }

  if (data.members.length > MAX_MEMBERS) {
    throw new Error(`data.members exceeds the maximum allowed length of ${MAX_MEMBERS}`);
  }

  for (const member of data.members) {
    if (!member || typeof member !== "object") {
      throw new Error("Member items must be objects");
    }
    if (typeof member.memberId !== "string") {
      throw new Error("memberId must be a string");
    }
  }
}

export function validateSourceReports(sourceReports) {
  if (!Array.isArray(sourceReports)) {
    throw new Error("sourceReports must be an array");
  }

  if (sourceReports.length > MAX_SOURCE_REPORTS) {
    throw new Error(`sourceReports exceeds the maximum allowed length of ${MAX_SOURCE_REPORTS}`);
  }

  for (const report of sourceReports) {
    if (!report || typeof report !== "object") {
      throw new Error("Source report items must be objects");
    }
  }
}
