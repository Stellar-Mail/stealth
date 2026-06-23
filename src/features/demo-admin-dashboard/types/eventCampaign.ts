export type EventCampaignKind = "conference" | "workshop" | "meetup" | "webinar";

export interface EventCampaignConfig {
  id: string;
  kind: EventCampaignKind;
  name: string;
  description: string;
  organizer: string;
  organizerEmail: string;
  eventDate: string;
  venue: string;
  capacity: number;
}

export interface EventCampaignTimelinePhase {
  phaseKind: "planning" | "registration" | "active" | "followup";
  label: string;
  startAt: string;
  endAt: string;
  description: string;
}

export interface EventCampaignMessage {
  subject: string;
  body: string;
  labels: string[];
  sendAfter: string;
}

export interface EventCampaignFixture {
  config: EventCampaignConfig;
  timelinePhases: EventCampaignTimelinePhase[];
  messages: EventCampaignMessage[];
  calendarEvents: {
    title: string;
    startTime: string;
    endTime: string;
    location: string;
    attendees: string[];
  }[];
}
