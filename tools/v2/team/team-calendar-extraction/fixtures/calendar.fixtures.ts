import type { CalendarEvent, CalendarExtractionRequest } from "../types";

/**
 * Calendar Event Fixtures
 *
 * Local test data for the Team Calendar Extraction tool.
 * Use these in local testing, demo modes, and to verify accessibility.
 */

const baseDate = new Date();

export const mockCalendarEvents: CalendarEvent[] = [
  {
    id: "event-1",
    title: "Sprint Planning - Week 24",
    description:
      "Bi-weekly sprint planning session with the engineering team to review upcoming tasks and assign responsibilities.",
    startDate: new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000),
    endDate: new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    allDay: false,
    location: "Conference Room A / Zoom",
    attendees: ["alice@team.com", "bob@team.com", "charlie@team.com", "diana@team.com"],
    organizer: "alice@team.com",
    priority: "high",
    category: "meeting",
    status: "extracted",
    source: "email",
    sourceRef: "extraction-1",
    tags: ["sprint", "engineering", "planning"],
    extractedAt: new Date(baseDate.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "event-2",
    title: "Q2 Budget Review Deadline",
    description:
      "Final deadline for submitting Q2 budget reviews to the finance department. All department heads must submit by EOD.",
    startDate: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000),
    allDay: true,
    attendees: ["finance@team.com", "admin@team.com"],
    organizer: "finance@team.com",
    priority: "urgent",
    category: "deadline",
    status: "extracted",
    source: "email",
    tags: ["budget", "finance", "deadline"],
    extractedAt: new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "event-3",
    title: "Team Standup",
    description: "Daily team standup to discuss progress, blockers, and plans for the day.",
    startDate: new Date(baseDate.getTime() + 0.25 * 24 * 60 * 60 * 1000),
    endDate: new Date(baseDate.getTime() + 0.25 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
    allDay: false,
    location: "Slack Huddle",
    attendees: [
      "alice@team.com",
      "bob@team.com",
      "charlie@team.com",
      "diana@team.com",
      "eve@team.com",
    ],
    organizer: "alice@team.com",
    priority: "normal",
    category: "meeting",
    status: "extracted",
    source: "email",
    tags: ["standup", "daily", "team"],
    extractedAt: new Date(baseDate.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "event-4",
    title: "Product Demo - New Features",
    description:
      "Monthly product demo showcasing new features developed during the sprint to stakeholders.",
    startDate: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
    endDate: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000),
    allDay: false,
    location: "Main Auditorium",
    attendees: [
      "product@team.com",
      "engineering@team.com",
      "design@team.com",
      "stakeholders@team.com",
    ],
    organizer: "product@team.com",
    priority: "high",
    category: "meeting",
    status: "extracted",
    source: "calendar_link",
    tags: ["demo", "product", "stakeholders"],
    extractedAt: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "event-5",
    title: "Doctor's Appointment",
    description: "Annual check-up appointment.",
    startDate: new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
    endDate: new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
    allDay: false,
    location: "City Medical Center",
    attendees: ["user@team.com"],
    organizer: "user@team.com",
    priority: "normal",
    category: "personal",
    status: "extracted",
    source: "manual",
    tags: ["personal", "health", "appointment"],
    extractedAt: new Date(baseDate.getTime() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: "event-6",
    title: "Project Milestone: Beta Launch",
    description:
      "Beta launch milestone for the stealth project. All features must be complete and tested.",
    startDate: new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000),
    allDay: true,
    attendees: ["engineering@team.com", "product@team.com", "qa@team.com"],
    organizer: "product@team.com",
    priority: "urgent",
    category: "milestone",
    status: "extracted",
    source: "email",
    tags: ["milestone", "launch", "beta"],
    extractedAt: new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: "event-7",
    title: "Team Lunch - Quarterly Celebration",
    description: "Quarterly team celebration lunch. Team building and recognition awards.",
    startDate: new Date(baseDate.getTime() + 10 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
    endDate: new Date(baseDate.getTime() + 10 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
    allDay: false,
    location: "The Grill House",
    attendees: [
      "alice@team.com",
      "bob@team.com",
      "charlie@team.com",
      "diana@team.com",
      "eve@team.com",
      "frank@team.com",
    ],
    organizer: "hr@team.com",
    priority: "low",
    category: "meeting",
    status: "extracted",
    source: "email",
    tags: ["celebration", "team-building", "lunch"],
    extractedAt: new Date(baseDate.getTime() - 4 * 24 * 60 * 60 * 1000),
  },
  {
    id: "event-8",
    title: "Security Training Reminder",
    description: "Mandatory annual security awareness training. Must be completed by end of month.",
    startDate: new Date(baseDate.getTime() + 20 * 24 * 60 * 60 * 1000),
    allDay: true,
    attendees: ["all-staff@team.com"],
    organizer: "security@team.com",
    priority: "high",
    category: "reminder",
    status: "pending",
    source: "email",
    tags: ["training", "security", "mandatory"],
    extractedAt: new Date(baseDate.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "event-9",
    title: "Design Review - Dashboard Redesign",
    description:
      "Review the new dashboard redesign mockups with the design team and provide feedback.",
    startDate: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000),
    endDate: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000),
    allDay: false,
    location: "Design Lab / Figma",
    attendees: ["design@team.com", "product@team.com", "engineering@team.com"],
    organizer: "design@team.com",
    priority: "normal",
    category: "meeting",
    status: "failed",
    source: "attachment",
    tags: ["design", "review", "dashboard"],
    extractedAt: new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "event-10",
    title: "One-on-One with Manager",
    description: "Weekly one-on-one meeting to discuss progress, goals, and any concerns.",
    startDate: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
    endDate: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000 + 9 * 30 * 60 * 60 * 1000),
    allDay: false,
    location: "Manager's Office",
    attendees: ["manager@team.com", "user@team.com"],
    organizer: "manager@team.com",
    priority: "high",
    category: "meeting",
    status: "extracted",
    source: "email",
    tags: ["one-on-one", "manager", "weekly"],
    extractedAt: new Date(baseDate.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
];

export const mockExtractionRequests: CalendarExtractionRequest[] = [
  {
    id: "extraction-1",
    title: "Email: Project Updates Thread",
    source: "email",
    sourceRef: "email-thread-123",
    requestedBy: "Alice Johnson",
    requestedAt: new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000),
    status: "extracted",
    events: mockCalendarEvents.filter((e) => e.source === "email"),
    eventCount: 8,
    extractedCount: 7,
    failedCount: 1,
  },
  {
    id: "extraction-2",
    title: "Calendar: Shared Team Calendar",
    source: "calendar_link",
    sourceRef: "cal-link-456",
    requestedBy: "Bob Smith",
    requestedAt: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000),
    status: "extracted",
    events: mockCalendarEvents.filter((e) => e.source === "calendar_link"),
    eventCount: 3,
    extractedCount: 3,
    failedCount: 0,
  },
  {
    id: "extraction-3",
    title: "Manual: Personal Events Entry",
    source: "manual",
    sourceRef: undefined,
    requestedBy: "Charlie Davis",
    requestedAt: new Date(baseDate.getTime() - 5 * 24 * 60 * 60 * 1000),
    status: "extracted",
    events: mockCalendarEvents.filter((e) => e.source === "manual"),
    eventCount: 2,
    extractedCount: 2,
    failedCount: 0,
  },
  {
    id: "extraction-4",
    title: "Attachment: MeetingNotes.pdf",
    source: "attachment",
    sourceRef: "attachment-789",
    requestedBy: "Diana Wilson",
    requestedAt: new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000),
    status: "failed",
    events: [],
    eventCount: 5,
    extractedCount: 0,
    failedCount: 5,
    notes: "Failed to parse attachment format",
  },
];

/**
 * Get mock events by status
 */
export function getMockEventsByStatus(status: string): CalendarEvent[] {
  return mockCalendarEvents.filter((e) => e.status === status);
}

/**
 * Get mock events by category
 */
export function getMockEventsByCategory(category: string): CalendarEvent[] {
  return mockCalendarEvents.filter((e) => e.category === category);
}

/**
 * Get mock upcoming events (today or later)
 */
export function getMockUpcomingEvents(): CalendarEvent[] {
  const now = new Date();
  return mockCalendarEvents.filter((e) => e.startDate >= now && e.status === "extracted");
}

/**
 * Get source events for simulation (new events not yet extracted)
 */
export const mockSourceEvents: CalendarEvent[] = [
  {
    id: "source-event-1",
    title: "New: Hackathon Planning Meeting",
    description:
      "Planning session for the upcoming internal hackathon. Brainstorm ideas and form teams.",
    startDate: new Date(baseDate.getTime() + 12 * 24 * 60 * 60 * 1000),
    endDate: new Date(baseDate.getTime() + 12 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
    allDay: false,
    location: "Innovation Lab",
    attendees: [
      "alice@team.com",
      "bob@team.com",
      "charlie@team.com",
      "diana@team.com",
      "eve@team.com",
    ],
    organizer: "hr@team.com",
    priority: "normal",
    category: "meeting",
    status: "pending",
    source: "email",
    tags: ["hackathon", "innovation", "planning"],
    extractedAt: new Date(),
  },
  {
    id: "source-event-2",
    title: "New: Performance Reviews Due",
    description: "All managers must submit performance reviews for their direct reports.",
    startDate: new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000),
    allDay: true,
    attendees: ["all-managers@team.com"],
    organizer: "hr@team.com",
    priority: "urgent",
    category: "deadline",
    status: "pending",
    source: "email",
    tags: ["performance", "reviews", "hr"],
    extractedAt: new Date(),
  },
  {
    id: "source-event-3",
    title: "New: Conference - Tech Summit 2026",
    description: "Annual tech summit with workshops, talks, and networking opportunities.",
    startDate: new Date(baseDate.getTime() + 45 * 24 * 60 * 60 * 1000),
    endDate: new Date(baseDate.getTime() + 47 * 24 * 60 * 60 * 1000),
    allDay: true,
    location: "Convention Center",
    attendees: ["engineering@team.com", "product@team.com"],
    organizer: "events@team.com",
    priority: "low",
    category: "milestone",
    status: "pending",
    source: "email",
    tags: ["conference", "tech", "summit"],
    extractedAt: new Date(),
  },
  {
    id: "source-event-4",
    title: "New: Team Retrospective",
    description: "Sprint retrospective to discuss what went well, what didn't, and action items.",
    startDate: new Date(baseDate.getTime() + 8 * 24 * 60 * 60 * 1000),
    endDate: new Date(baseDate.getTime() + 8 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000),
    allDay: false,
    location: "Virtual / Discord",
    attendees: ["engineering@team.com", "product@team.com"],
    organizer: "scrum-master@team.com",
    priority: "normal",
    category: "meeting",
    status: "pending",
    source: "email",
    tags: ["retro", "sprint", "agile"],
    extractedAt: new Date(),
  },
  {
    id: "source-event-5",
    title: "New: Vendor Contract Renewal",
    description: "Review and sign the renewal contract for the cloud infrastructure vendor.",
    startDate: new Date(baseDate.getTime() + 21 * 24 * 60 * 60 * 1000),
    allDay: true,
    attendees: ["legal@team.com", "finance@team.com"],
    organizer: "procurement@team.com",
    priority: "high",
    category: "deadline",
    status: "pending",
    source: "attachment",
    tags: ["vendor", "contract", "renewal"],
    extractedAt: new Date(),
  },
];

/**
 * Get a single mock event by ID
 */
export function getMockEvent(id: string): CalendarEvent | undefined {
  return mockCalendarEvents.find((e) => e.id === id);
}

/**
 * Get a single mock extraction request by ID
 */
export function getMockExtractionRequest(id: string): CalendarExtractionRequest | undefined {
  return mockExtractionRequests.find((r) => r.id === id);
}
