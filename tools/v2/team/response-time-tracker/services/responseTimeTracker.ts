export type ResponseDirection = "inbound" | "outbound";

export interface ResponseTimeEvent {
  id: string;
  conversationId: string;
  direction: ResponseDirection;
  sentAt: string;
  actorId?: string;
  actorName?: string;
  customerId?: string;
  subject?: string;
}

export interface ResponseTimeTrackerOptions {
  now?: string;
  slaMinutes?: number;
}

export interface ResponsePair {
  conversationId: string;
  inboundEventId: string;
  responseEventId: string;
  inboundAt: string;
  responseAt: string;
  responseMinutes: number;
  withinSla: boolean;
  responderId?: string;
  responderName?: string;
}

export interface PendingInbound {
  conversationId: string;
  inboundEventId: string;
  inboundAt: string;
  ageMinutes: number;
  customerId?: string;
  subject?: string;
}

export interface ConversationResponseSummary {
  conversationId: string;
  inboundCount: number;
  responseCount: number;
  pendingCount: number;
  averageResponseMinutes: number | null;
  medianResponseMinutes: number | null;
  longestResponseMinutes: number | null;
  slaBreachCount: number;
  pending: PendingInbound[];
  responses: ResponsePair[];
}

export interface ResponseTimeTotals {
  conversationCount: number;
  inboundCount: number;
  responseCount: number;
  pendingCount: number;
  averageResponseMinutes: number | null;
  medianResponseMinutes: number | null;
  longestResponseMinutes: number | null;
  slaBreachCount: number;
}

export interface ResponseTimeReadyState {
  status: "ready";
  generatedAt: string;
  slaMinutes: number;
  totals: ResponseTimeTotals;
  conversations: ConversationResponseSummary[];
}

export interface ResponseTimeLoadingState {
  status: "loading";
  message: string;
}

export interface ResponseTimeErrorState {
  status: "error";
  message: string;
  details?: string[];
}

export type ResponseTimeTrackerState =
  | ResponseTimeLoadingState
  | ResponseTimeErrorState
  | ResponseTimeReadyState;

const DEFAULT_SLA_MINUTES = 120;

export function createResponseTimeLoadingState(
  message = "Preparing response-time metrics.",
): ResponseTimeLoadingState {
  return {
    status: "loading",
    message,
  };
}

export function createResponseTimeErrorState(
  message: string,
  details: string[] = [],
): ResponseTimeErrorState {
  return {
    status: "error",
    message,
    details,
  };
}

export function summarizeResponseTimes(
  events: ResponseTimeEvent[],
  options: ResponseTimeTrackerOptions = {},
): ResponseTimeReadyState {
  const slaMinutes = options.slaMinutes ?? DEFAULT_SLA_MINUTES;
  const now = parseTimestamp(options.now ?? new Date().toISOString(), "options.now");
  const validatedEvents = events.map((event) => ({
    event,
    sentAt: parseTimestamp(event.sentAt, `event ${event.id}`),
  }));

  validateEvents(
    validatedEvents.map(({ event }) => event),
    slaMinutes,
  );

  const sortedEvents = validatedEvents.sort((left, right) => {
    const timeDelta = left.sentAt.getTime() - right.sentAt.getTime();
    if (timeDelta !== 0) {
      return timeDelta;
    }

    return left.event.id.localeCompare(right.event.id);
  });

  const conversations = new Map<
    string,
    {
      inbound: ResponseTimeEvent[];
      pending: ResponseTimeEvent[];
      responses: ResponsePair[];
    }
  >();

  for (const { event } of sortedEvents) {
    const bucket = getConversationBucket(conversations, event.conversationId);

    if (event.direction === "inbound") {
      bucket.inbound.push(event);
      bucket.pending.push(event);
      continue;
    }

    const nextPending = bucket.pending.shift();
    if (!nextPending) {
      continue;
    }

    const responseMinutes = minutesBetween(nextPending.sentAt, event.sentAt);
    bucket.responses.push({
      conversationId: event.conversationId,
      inboundEventId: nextPending.id,
      responseEventId: event.id,
      inboundAt: nextPending.sentAt,
      responseAt: event.sentAt,
      responseMinutes,
      withinSla: responseMinutes <= slaMinutes,
      responderId: event.actorId,
      responderName: event.actorName,
    });
  }

  const summaries = [...conversations.entries()]
    .map(([conversationId, bucket]) =>
      buildConversationSummary(
        conversationId,
        bucket.inbound,
        bucket.pending,
        bucket.responses,
        now,
        slaMinutes,
      ),
    )
    .sort((left, right) => left.conversationId.localeCompare(right.conversationId));

  const allResponses = summaries.flatMap((summary) => summary.responses);
  const responseDurations = allResponses.map((response) => response.responseMinutes);

  return {
    status: "ready",
    generatedAt: now.toISOString(),
    slaMinutes,
    totals: {
      conversationCount: summaries.length,
      inboundCount: summaries.reduce((total, summary) => total + summary.inboundCount, 0),
      responseCount: allResponses.length,
      pendingCount: summaries.reduce((total, summary) => total + summary.pendingCount, 0),
      averageResponseMinutes: average(responseDurations),
      medianResponseMinutes: median(responseDurations),
      longestResponseMinutes: max(responseDurations),
      slaBreachCount: allResponses.filter((response) => !response.withinSla).length,
    },
    conversations: summaries,
  };
}

export function safeSummarizeResponseTimes(
  events: ResponseTimeEvent[],
  options: ResponseTimeTrackerOptions = {},
): ResponseTimeTrackerState {
  try {
    return summarizeResponseTimes(events, options);
  } catch (error) {
    return createResponseTimeErrorState("Response-time tracker could not build metrics.", [
      error instanceof Error ? error.message : String(error),
    ]);
  }
}

function validateEvents(events: ResponseTimeEvent[], slaMinutes: number): void {
  if (!Number.isFinite(slaMinutes) || slaMinutes <= 0) {
    throw new Error("slaMinutes must be a positive number.");
  }

  for (const event of events) {
    if (!event.id.trim()) {
      throw new Error("Every event requires an id.");
    }

    if (!event.conversationId.trim()) {
      throw new Error(`Event ${event.id} requires a conversationId.`);
    }
  }
}

function getConversationBucket(
  conversations: Map<
    string,
    {
      inbound: ResponseTimeEvent[];
      pending: ResponseTimeEvent[];
      responses: ResponsePair[];
    }
  >,
  conversationId: string,
) {
  const existingBucket = conversations.get(conversationId);
  if (existingBucket) {
    return existingBucket;
  }

  const bucket = {
    inbound: [],
    pending: [],
    responses: [],
  };
  conversations.set(conversationId, bucket);
  return bucket;
}

function buildConversationSummary(
  conversationId: string,
  inbound: ResponseTimeEvent[],
  pending: ResponseTimeEvent[],
  responses: ResponsePair[],
  now: Date,
  slaMinutes: number,
): ConversationResponseSummary {
  const responseDurations = responses.map((response) => response.responseMinutes);

  return {
    conversationId,
    inboundCount: inbound.length,
    responseCount: responses.length,
    pendingCount: pending.length,
    averageResponseMinutes: average(responseDurations),
    medianResponseMinutes: median(responseDurations),
    longestResponseMinutes: max(responseDurations),
    slaBreachCount: responses.filter((response) => !response.withinSla).length,
    pending: pending.map((event) => ({
      conversationId,
      inboundEventId: event.id,
      inboundAt: event.sentAt,
      ageMinutes: minutesBetween(event.sentAt, now.toISOString()),
      customerId: event.customerId,
      subject: event.subject,
    })),
    responses: responses.map((response) => ({
      ...response,
      withinSla: response.responseMinutes <= slaMinutes,
    })),
  };
}

function parseTimestamp(value: string, context: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${context} has an invalid timestamp.`);
  }

  return parsed;
}

function minutesBetween(start: string, end: string): number {
  const startDate = parseTimestamp(start, "start");
  const endDate = parseTimestamp(end, "end");
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[midpoint];
  }

  return Math.round((sorted[midpoint - 1] + sorted[midpoint]) / 2);
}

function max(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}
