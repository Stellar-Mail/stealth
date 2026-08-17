import { validateDashboardData } from "../guards/analytics-guards.mjs";

const SLA_THRESHOLD_HOURS = 4;
const OVERLOAD_OPEN_THRESHOLD = 10;
const OVERLOAD_SLA_BREACH_THRESHOLD = 2;

function classifyMemberStatus(member) {
  if (member.emailsReceived === 0 && member.emailsHandled === 0 && member.openThreads === 0) {
    return "away";
  }

  const isOverloaded =
    member.openThreads > OVERLOAD_OPEN_THRESHOLD ||
    member.slaBreaches > OVERLOAD_SLA_BREACH_THRESHOLD;
  if (isOverloaded) {
    return "overloaded";
  }

  if (
    member.openThreads === 0 &&
    member.resolvedThreads > 0 &&
    member.emailsHandled === member.emailsReceived
  ) {
    return "underutilized";
  }

  return "active";
}

function computeAvgResponseTime(members) {
  const activeMembers = members.filter(
    (m) => m.status !== "away" && m.avgResponseTimeHours !== null,
  );
  if (activeMembers.length === 0) return null;
  const total = activeMembers.reduce((sum, m) => sum + m.avgResponseTimeHours, 0);
  return Math.round((total / activeMembers.length) * 10) / 10;
}

function findTopPerformer(members) {
  const eligible = members.filter((m) => m.status === "active" && m.slaBreaches === 0);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, current) =>
    current.avgResponseTimeHours < best.avgResponseTimeHours ? current : best,
  ).memberId;
}

function findBottleneck(members) {
  return members.reduce((max, current) => (current.openThreads > max.openThreads ? current : max))
    .memberId;
}

function findReviewRequired(members) {
  return members.filter((m) => m.slaBreaches > 0).map((m) => m.memberId);
}

/**
 * @param {import("../contract/analytics-contract").DashboardInput} data
 * @returns {import("../contract/analytics-contract").DashboardReport}
 */
export function generateDashboardReport(data) {
  validateDashboardData(data);

  const { members, period, teamId } = data;

  const enhancedMembers = members.map((m) => ({
    ...m,
    status: classifyMemberStatus(m),
  }));

  const summary = {
    totalEmailVolume: members.reduce((n, m) => n + m.emailsReceived, 0),
    totalHandled: members.reduce((n, m) => n + m.emailsHandled, 0),
    totalOpen: members.reduce((n, m) => n + m.openThreads, 0),
    teamAvgResponseTimeHours: computeAvgResponseTime(enhancedMembers),
    totalSlaBreaches: members.reduce((n, m) => n + m.slaBreaches, 0),
    topPerformerId: findTopPerformer(enhancedMembers),
    bottleneckMemberId: findBottleneck(enhancedMembers),
    reviewRequiredMemberIds: findReviewRequired(enhancedMembers),
  };

  return {
    teamId,
    period,
    members: enhancedMembers,
    summary,
  };
}
