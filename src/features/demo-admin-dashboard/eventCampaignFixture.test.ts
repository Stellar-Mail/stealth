import { describe, it, expect } from "vitest";
import {
  EVENT_CAMPAIGN_FIXTURES,
  EVENT_CAMPAIGN_KINDS,
  getEventCampaignFixtureById,
  getEventCampaignFixturesByKind,
} from "./fixtures/eventCampaignFixture";
import { validateEventCampaignFixture } from "./utils/eventCampaignHelpers";

describe("EVENT_CAMPAIGN_FIXTURES", () => {
  it("exports at least one fixture", () => {
    expect(EVENT_CAMPAIGN_FIXTURES.length).toBeGreaterThan(0);
  });

  it("every fixture passes validation", () => {
    for (const fixture of EVENT_CAMPAIGN_FIXTURES) {
      const issues = validateEventCampaignFixture(fixture);
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors, `Fixture "${fixture.config.id}" has validation errors`).toEqual([]);
    }
  });

  it("every fixture has a unique id", () => {
    const ids = EVENT_CAMPAIGN_FIXTURES.map((f) => f.config.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every fixture has at least one message", () => {
    for (const fixture of EVENT_CAMPAIGN_FIXTURES) {
      expect(fixture.messages.length).toBeGreaterThan(0);
    }
  });

  it("every fixture has at least one timeline phase", () => {
    for (const fixture of EVENT_CAMPAIGN_FIXTURES) {
      expect(fixture.timelinePhases.length).toBeGreaterThan(0);
    }
  });

  it("all messages have non-empty subject and body", () => {
    for (const fixture of EVENT_CAMPAIGN_FIXTURES) {
      fixture.messages.forEach((msg, i) => {
        expect(
          msg.subject.trim(),
          `Fixture "${fixture.config.id}" message[${i}] subject is empty`,
        ).not.toBe("");
        expect(
          msg.body.trim(),
          `Fixture "${fixture.config.id}" message[${i}] body is empty`,
        ).not.toBe("");
      });
    }
  });

  it("all calendar events have valid title and time range", () => {
    for (const fixture of EVENT_CAMPAIGN_FIXTURES) {
      fixture.calendarEvents.forEach((evt, i) => {
        expect(
          evt.title.trim(),
          `Fixture "${fixture.config.id}" calendarEvent[${i}] title is empty`,
        ).not.toBe("");
        expect(
          evt.startTime.trim(),
          `Fixture "${fixture.config.id}" calendarEvent[${i}] startTime is empty`,
        ).not.toBe("");
        expect(
          evt.endTime.trim(),
          `Fixture "${fixture.config.id}" calendarEvent[${i}] endTime is empty`,
        ).not.toBe("");
      });
    }
  });

  it("conference fixture has conference-specific labels", () => {
    const conf = getEventCampaignFixtureById("evt-camp-conference-001");
    expect(conf).toBeDefined();
    const allLabels = conf!.messages.flatMap((m) => m.labels);
    expect(allLabels).toContain("Conference");
    expect(allLabels).toContain("Ticket");
    expect(allLabels).toContain("Follow-up");
  });

  it("conference fixture has a calendar event with the day-1 agenda", () => {
    const conf = getEventCampaignFixtureById("evt-camp-conference-001");
    const titles = conf!.calendarEvents.map((e) => e.title);
    expect(titles).toContain("StealthCon 2026 — Day 1");
    expect(titles).toContain("StealthCon Networking Reception");
    expect(titles).toContain("Post-Conference Community Meetup");
  });

  it("conference fixture has all four timeline phases", () => {
    const conf = getEventCampaignFixtureById("evt-camp-conference-001");
    const kinds = conf!.timelinePhases.map((p) => p.phaseKind);
    expect(kinds).toEqual(["planning", "registration", "active", "followup"]);
  });

  it("conference fixture includes follow-up messages", () => {
    const conf = getEventCampaignFixtureById("evt-camp-conference-001");
    const followUpSubjects = conf!.messages
      .filter((m) => m.labels.includes("Follow-up"))
      .map((m) => m.subject);
    expect(followUpSubjects.length).toBeGreaterThanOrEqual(2);
  });

  it("workshop fixture has workshop-specific labels", () => {
    const ws = getEventCampaignFixtureById("evt-camp-workshop-001");
    expect(ws).toBeDefined();
    const allLabels = ws!.messages.flatMap((m) => m.labels);
    expect(allLabels).toContain("Workshop");
    expect(allLabels).toContain("Confirmation");
    expect(allLabels).toContain("Survey");
  });

  it("returns undefined for unknown id", () => {
    expect(getEventCampaignFixtureById("nonexistent")).toBeUndefined();
  });
});

describe("EVENT_CAMPAIGN_KINDS", () => {
  it("contains the standard event kinds", () => {
    expect(EVENT_CAMPAIGN_KINDS).toContain("conference");
    expect(EVENT_CAMPAIGN_KINDS).toContain("workshop");
    expect(EVENT_CAMPAIGN_KINDS).toContain("meetup");
    expect(EVENT_CAMPAIGN_KINDS).toContain("webinar");
  });
});

describe("getEventCampaignFixturesByKind", () => {
  it("returns conference fixtures", () => {
    const fixtures = getEventCampaignFixturesByKind("conference");
    expect(fixtures.length).toBeGreaterThan(0);
    fixtures.forEach((f) => expect(f.config.kind).toBe("conference"));
  });

  it("returns workshop fixtures", () => {
    const fixtures = getEventCampaignFixturesByKind("workshop");
    expect(fixtures.length).toBeGreaterThan(0);
    fixtures.forEach((f) => expect(f.config.kind).toBe("workshop"));
  });

  it("returns empty array for kind with no fixtures", () => {
    expect(getEventCampaignFixturesByKind("meetup")).toEqual([]);
  });
});

describe("validateEventCampaignFixture", () => {
  it("accepts a valid fixture", () => {
    const fixture = EVENT_CAMPAIGN_FIXTURES[0];
    const issues = validateEventCampaignFixture(fixture);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });

  it("rejects fixture with empty messages", () => {
    const fixture = {
      ...EVENT_CAMPAIGN_FIXTURES[0],
      messages: [],
    };
    const issues = validateEventCampaignFixture(fixture);
    expect(issues.some((i) => i.fieldPath === "messages")).toBe(true);
  });

  it("rejects fixture with empty timeline phases", () => {
    const fixture = {
      ...EVENT_CAMPAIGN_FIXTURES[0],
      timelinePhases: [],
    };
    const issues = validateEventCampaignFixture(fixture);
    expect(issues.some((i) => i.fieldPath === "timelinePhases")).toBe(true);
  });

  it("rejects message with empty subject", () => {
    const fixture = {
      ...EVENT_CAMPAIGN_FIXTURES[0],
      messages: [{ subject: "", body: "body", labels: [], sendAfter: "" }],
    };
    const issues = validateEventCampaignFixture(fixture);
    expect(issues.some((i) => i.fieldPath === "messages[0].subject")).toBe(true);
  });
});
