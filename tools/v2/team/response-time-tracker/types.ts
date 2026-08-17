export interface ResponseTimeEntry {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  sentAt: string;
  respondedAt: string;
  responseTimeMs: number;
  teamMemberId: string;
  status: "met" | "missed" | "breached";
}

export interface TeamMember {
  id: string;
  name: string;
}

export interface ResponseTimeMetrics {
  averageResponseTimeMs: number;
  medianResponseTimeMs: number;
  fastestResponseTimeMs: number;
  slowestResponseTimeMs: number;
  totalResponses: number;
  metCount: number;
  missedCount: number;
  breachedCount: number;
  slaMs: number;
  withinSLAPercentage: number;
}

export type FetchState<T> =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };

export interface DateRange {
  start: string;
  end: string;
}
