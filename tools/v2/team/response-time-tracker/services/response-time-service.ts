import type { DateRange, ResponseTimeEntry, ResponseTimeMetrics, TeamMember } from "../types";

import sampleEntries from "../fixtures/sample-response-times.json";
import sampleMembers from "../fixtures/team-members.json";

function msToHours(ms: number): number {
  return Math.round((ms / 3600000) * 10) / 10;
}

function calculateMetrics(entries: ResponseTimeEntry[]): ResponseTimeMetrics {
  const slaMs = 14400000;

  if (entries.length === 0) {
    return {
      averageResponseTimeMs: 0,
      medianResponseTimeMs: 0,
      fastestResponseTimeMs: 0,
      slowestResponseTimeMs: 0,
      totalResponses: 0,
      metCount: 0,
      missedCount: 0,
      breachedCount: 0,
      slaMs,
      withinSLAPercentage: 0,
    };
  }

  const sorted = [...entries].sort((a, b) => a.responseTimeMs - b.responseTimeMs);
  const total = sorted.length;
  const mid = Math.floor(total / 2);

  const met = entries.filter((e) => e.status === "met").length;
  const missed = entries.filter((e) => e.status === "missed").length;
  const breached = entries.filter((e) => e.status === "breached").length;

  return {
    averageResponseTimeMs: Math.round(entries.reduce((s, e) => s + e.responseTimeMs, 0) / total),
    medianResponseTimeMs:
      total % 2 === 0
        ? Math.round((sorted[mid - 1].responseTimeMs + sorted[mid].responseTimeMs) / 2)
        : sorted[mid].responseTimeMs,
    fastestResponseTimeMs: sorted[0].responseTimeMs,
    slowestResponseTimeMs: sorted[total - 1].responseTimeMs,
    totalResponses: total,
    metCount: met,
    missedCount: missed,
    breachedCount: breached,
    slaMs,
    withinSLAPercentage: Math.round((met / total) * 100),
  };
}

function filterByDateRange(entries: ResponseTimeEntry[], range: DateRange): ResponseTimeEntry[] {
  const start = new Date(range.start).getTime();
  const endExclusive = new Date(range.end).getTime() + 86400000;
  return entries.filter((e) => {
    const sent = new Date(e.sentAt).getTime();
    return sent >= start && sent < endExclusive;
  });
}

export interface ResponseTimeServiceConfig {
  simulateDelay?: boolean;
  delayMs?: number;
  failureRate?: number;
}

export function createResponseTimeService(config: ResponseTimeServiceConfig = {}) {
  const { simulateDelay = true, delayMs = 800, failureRate = 0 } = config;

  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  async function getEntries(range?: DateRange): Promise<ResponseTimeEntry[]> {
    if (simulateDelay) await delay(delayMs);

    if (Math.random() < failureRate) {
      throw new Error("Failed to load response time entries.");
    }

    let entries = sampleEntries as ResponseTimeEntry[];
    if (range) {
      entries = filterByDateRange(entries, range);
    }
    return entries;
  }

  async function getTeamMembers(): Promise<TeamMember[]> {
    if (simulateDelay) await delay(delayMs / 2);
    return sampleMembers as TeamMember[];
  }

  async function getMetrics(range?: DateRange): Promise<ResponseTimeMetrics> {
    const entries = await getEntries(range);
    return calculateMetrics(entries);
  }

  return { getEntries, getTeamMembers, getMetrics, calculateMetrics };
}

export type ResponseTimeService = ReturnType<typeof createResponseTimeService>;
