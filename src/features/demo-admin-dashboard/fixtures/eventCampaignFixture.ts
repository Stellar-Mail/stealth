import type {
  EventCampaignConfig,
  EventCampaignFixture,
  EventCampaignKind,
  EventCampaignMessage,
  EventCampaignTimelinePhase,
} from "../types/eventCampaign";

const CONFERENCE_CONFIG: EventCampaignConfig = {
  id: "evt-camp-conference-001",
  kind: "conference",
  name: "StealthCon 2026",
  description:
    "Annual Stealth community conference featuring protocol updates, relay workshops, and ecosystem networking.",
  organizer: "StealthCon Team",
  organizerEmail: "team@stealthcon.stealth.demo",
  eventDate: "2026-09-15",
  venue: "Stealth HQ & Virtual",
  capacity: 2500,
};

const TIMELINE_PHASES: EventCampaignTimelinePhase[] = [
  {
    phaseKind: "planning",
    label: "Planning & Content Prep",
    startAt: "2026-08-01T00:00",
    endAt: "2026-08-21T23:59",
    description:
      "Finalize speaker lineup, session schedule, and draft email templates.",
  },
  {
    phaseKind: "registration",
    label: "Registration & Ticket Sales",
    startAt: "2026-08-22T00:00",
    endAt: "2026-09-08T23:59",
    description:
      "Accept registrations, issue digital passes, and send onboarding materials.",
  },
  {
    phaseKind: "active",
    label: "Event Week",
    startAt: "2026-09-09T00:00",
    endAt: "2026-09-16T23:59",
    description:
      "Main conference window including pre-events, keynotes, and closing ceremony.",
  },
  {
    phaseKind: "followup",
    label: "Post-Event Follow-up",
    startAt: "2026-09-17T00:00",
    endAt: "2026-09-30T23:59",
    description:
      "Send thank-you messages, survey links, and attendance certificates.",
  },
];

const MESSAGES: EventCampaignMessage[] = [
  {
    subject: "Your StealthCon 2026 pass is ready",
    body: "Your digital pass for StealthCon 2026 is attached. You can add the event to your calendar to receive session reminders and schedule updates. We look forward to seeing you there!",
    labels: ["Conference", "Ticket", "Important"],
    sendAfter: "2026-08-22T09:00",
  },
  {
    subject: "StealthCon 2026 — One week away!",
    body: "StealthCon 2026 starts in just one week. Check out the final speaker lineup and start planning your agenda. Early arrivals can join the pre-conference workshop on Thursday.",
    labels: ["Conference", "Reminder"],
    sendAfter: "2026-09-08T10:00",
  },
  {
    subject: "Final reminder: StealthCon is tomorrow",
    body: "StealthCon 2026 kicks off tomorrow at 9:00 AM at Stealth HQ. Make sure to bring your digital pass for check-in. Virtual attendees will receive a streaming link one hour before the keynote.",
    labels: ["Conference", "Reminder"],
    sendAfter: "2026-09-14T08:00",
  },
  {
    subject: "Calendar invite: StealthCon 2026",
    body: "You are invited to StealthCon 2026. The event runs from September 15–16 at Stealth HQ with a virtual attendance option. Add this event to your calendar to receive session reminders.",
    labels: ["Conference", "Calendar"],
    sendAfter: "2026-08-22T09:00",
  },
  {
    subject: "Thanks for attending StealthCon 2026",
    body: "Thank you for joining us at StealthCon 2026. We hope you enjoyed the sessions and made valuable connections. Your attendance certificate is attached.",
    labels: ["Conference", "Follow-up"],
    sendAfter: "2026-09-17T10:00",
  },
  {
    subject: "Share your StealthCon feedback",
    body: "We would love to hear about your StealthCon experience. Please take a few minutes to fill out our post-event survey. Your input helps us make future events even better.",
    labels: ["Conference", "Survey"],
    sendAfter: "2026-09-18T10:00",
  },
  {
    subject: "We missed you at StealthCon 2026",
    body: "We noticed you were unable to attend StealthCon 2026. Recordings of all keynotes and sessions are now available on demand. We hope to see you at our next event.",
    labels: ["Conference", "Follow-up"],
    sendAfter: "2026-09-20T10:00",
  },
];

const CALENDAR_EVENTS: {
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  attendees: string[];
}[] = [
  {
    title: "StealthCon 2026 — Day 1",
    startTime: "2026-09-15T09:00",
    endTime: "2026-09-15T18:00",
    location: "Stealth HQ Auditorium & Virtual",
    attendees: ["eve@stealth.xyz", "participant@stealth.demo"],
  },
  {
    title: "StealthCon 2026 — Day 2",
    startTime: "2026-09-16T09:00",
    endTime: "2026-09-16T17:00",
    location: "Stealth HQ Auditorium & Virtual",
    attendees: ["eve@stealth.xyz", "participant@stealth.demo"],
  },
  {
    title: "Pre-Conference Workshop: Relay Architecture",
    startTime: "2026-09-14T14:00",
    endTime: "2026-09-14T17:00",
    location: "Workshop Room B",
    attendees: ["eve@stealth.xyz", "workshop-lead@stealth.demo"],
  },
  {
    title: "StealthCon Networking Reception",
    startTime: "2026-09-15T18:30",
    endTime: "2026-09-15T21:00",
    location: "Stealth HQ Rooftop Terrace",
    attendees: ["eve@stealth.xyz", "networking@stealth.demo"],
  },
  {
    title: "Post-Conference Community Meetup",
    startTime: "2026-09-17T18:00",
    endTime: "2026-09-17T20:00",
    location: "Downtown Co-Working Space",
    attendees: ["eve@stealth.xyz", "community-leads@stealth.demo"],
  },
];

const WORKSHOP_CONFIG: EventCampaignConfig = {
  id: "evt-camp-workshop-001",
  kind: "workshop",
  name: "Soroban Smart Contract Workshop",
  description:
    "Hands-on workshop for building and deploying Soroban smart contracts on the Stellar network.",
  organizer: "Developer Relations Team",
  organizerEmail: "devrel@stealth.demo",
  eventDate: "2026-10-05",
  venue: "Virtual — Zoom",
  capacity: 200,
};

const WORKSHOP_TIMELINE_PHASES: EventCampaignTimelinePhase[] = [
  {
    phaseKind: "planning",
    label: "Curriculum Design",
    startAt: "2026-09-01T00:00",
    endAt: "2026-09-14T23:59",
    description:
      "Prepare workshop materials, code examples, and slide decks.",
  },
  {
    phaseKind: "registration",
    label: "Participant Registration",
    startAt: "2026-09-15T00:00",
    endAt: "2026-10-01T23:59",
    description:
      "Open registration, send confirmation emails and pre-workshop prep notes.",
  },
  {
    phaseKind: "active",
    label: "Workshop Day",
    startAt: "2026-10-05T09:00",
    endAt: "2026-10-05T17:00",
    description:
      "Live workshop sessions with hands-on coding exercises and Q&A.",
  },
  {
    phaseKind: "followup",
    label: "Post-Workshop",
    startAt: "2026-10-06T00:00",
    endAt: "2026-10-12T23:59",
    description:
      "Distribute certificates, recording links, and follow-up survey.",
  },
];

const WORKSHOP_MESSAGES: EventCampaignMessage[] = [
  {
    subject: "Your Soroban Workshop confirmation",
    body: "You are confirmed for the Soroban Smart Contract Workshop on October 5th. A Zoom link and prep materials will be sent closer to the date.",
    labels: ["Workshop", "Confirmation"],
    sendAfter: "2026-09-15T10:00",
  },
  {
    subject: "Soroban Workshop — Prep materials enclosed",
    body: "The Soroban Smart Contract Workshop is one week away. Please review the attached preparation guide and ensure your development environment is set up.",
    labels: ["Workshop", "Prep"],
    sendAfter: "2026-09-28T10:00",
  },
  {
    subject: "Soroban Workshop — Zoom link & schedule",
    body: "The workshop starts tomorrow at 9:00 AM. Here is your Zoom link and the full schedule. See you there!",
    labels: ["Workshop", "Reminder"],
    sendAfter: "2026-10-04T08:00",
  },
  {
    subject: "Thanks for joining the Soroban Workshop",
    body: "Thank you for participating in the Soroban Smart Contract Workshop. Your certificate of completion is attached, along with links to the recording and code repository.",
    labels: ["Workshop", "Follow-up"],
    sendAfter: "2026-10-06T10:00",
  },
  {
    subject: "Soroban Workshop feedback survey",
    body: "Help us improve future workshops by sharing your feedback. The survey takes less than five minutes.",
    labels: ["Workshop", "Survey"],
    sendAfter: "2026-10-07T10:00",
  },
];

export const EVENT_CAMPAIGN_KINDS: EventCampaignKind[] = [
  "conference",
  "workshop",
  "meetup",
  "webinar",
];

export const EVENT_CAMPAIGN_FIXTURES: EventCampaignFixture[] = [
  {
    config: CONFERENCE_CONFIG,
    timelinePhases: TIMELINE_PHASES,
    messages: MESSAGES,
    calendarEvents: CALENDAR_EVENTS,
  },
  {
    config: WORKSHOP_CONFIG,
    timelinePhases: WORKSHOP_TIMELINE_PHASES,
    messages: WORKSHOP_MESSAGES,
    calendarEvents: [
      {
        title: "Soroban Smart Contract Workshop",
        startTime: "2026-10-05T09:00",
        endTime: "2026-10-05T17:00",
        location: "Virtual — Zoom",
        attendees: ["eve@stealth.xyz", "participant@stealth.demo"],
      },
    ],
  },
];

export function getEventCampaignFixtureById(
  id: string,
): EventCampaignFixture | undefined {
  return EVENT_CAMPAIGN_FIXTURES.find((fixture) => fixture.config.id === id);
}

export function getEventCampaignFixturesByKind(
  kind: EventCampaignKind,
): EventCampaignFixture[] {
  return EVENT_CAMPAIGN_FIXTURES.filter(
    (fixture) => fixture.config.kind === kind,
  );
}
