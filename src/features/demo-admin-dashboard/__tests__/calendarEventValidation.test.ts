import { describe, expect, it } from "vitest";
import { validateCalendarEventEditor } from "../calendarEventValidation";
import type { CalendarEventEditorState } from "../types/calendarEvent";

const validState: CalendarEventEditorState = {
  id: "evt-test",
  title: "Team Standup",
  startTime: "2026-06-23T09:00",
  endTime: "2026-06-23T09:30",
  location: "Room 101",
  attendees: ["eve@stealth.xyz"],
  responseState: "needsAction",
};

describe("validateCalendarEventEditor", () => {
  it("returns no errors for a valid event", () => {
    const issues = validateCalendarEventEditor(validState);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("returns an error when title is empty", () => {
    const issues = validateCalendarEventEditor({ ...validState, title: "" });
    const titleIssues = issues.filter((i) => i.fieldPath === "title");
    expect(titleIssues.length).toBeGreaterThan(0);
    expect(titleIssues[0].severity).toBe("error");
  });

  it("returns an error when title is whitespace only", () => {
    const issues = validateCalendarEventEditor({ ...validState, title: "   " });
    const titleIssues = issues.filter((i) => i.fieldPath === "title");
    expect(titleIssues.length).toBeGreaterThan(0);
  });

  it("returns an error when startTime is empty", () => {
    const issues = validateCalendarEventEditor({ ...validState, startTime: "" });
    const startIssues = issues.filter((i) => i.fieldPath === "startTime");
    expect(startIssues.length).toBeGreaterThan(0);
    expect(startIssues[0].severity).toBe("error");
  });

  it("returns an error when endTime is empty", () => {
    const issues = validateCalendarEventEditor({ ...validState, endTime: "" });
    const endIssues = issues.filter((i) => i.fieldPath === "endTime");
    expect(endIssues.length).toBeGreaterThan(0);
    expect(endIssues[0].severity).toBe("error");
  });

  it("returns an error when startTime is invalid", () => {
    const issues = validateCalendarEventEditor({ ...validState, startTime: "not-a-date" });
    const startIssues = issues.filter((i) => i.fieldPath === "startTime");
    expect(startIssues.length).toBeGreaterThan(0);
    expect(startIssues[0].severity).toBe("error");
  });

  it("returns an error when endTime is invalid", () => {
    const issues = validateCalendarEventEditor({ ...validState, endTime: "not-a-date" });
    const endIssues = issues.filter((i) => i.fieldPath === "endTime");
    expect(endIssues.length).toBeGreaterThan(0);
  });

  it("returns an error when endTime is before startTime", () => {
    const issues = validateCalendarEventEditor({
      ...validState,
      startTime: "2026-06-23T10:00",
      endTime: "2026-06-23T09:00",
    });
    const endIssues = issues.filter(
      (i) => i.fieldPath === "endTime" && i.message.includes("after"),
    );
    expect(endIssues.length).toBeGreaterThan(0);
  });

  it("returns an error for invalid attendee address", () => {
    const issues = validateCalendarEventEditor({
      ...validState,
      attendees: ["invalid-address"],
    });
    const formatIssues = issues.filter((i) => i.message.includes("is not a valid"));
    expect(formatIssues.length).toBeGreaterThan(0);
  });

  it("returns a warning for unsafe attendee domain", () => {
    const issues = validateCalendarEventEditor({
      ...validState,
      attendees: ["user@unknown-domain.com"],
    });
    const domainIssues = issues.filter((i) => i.severity === "warning");
    expect(domainIssues.length).toBeGreaterThan(0);
  });

  it("passes for federated attendee addresses with *", () => {
    const issues = validateCalendarEventEditor({
      ...validState,
      attendees: ["eve*stealth.demo"],
    });
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("passes for example.com attendee addresses", () => {
    const issues = validateCalendarEventEditor({
      ...validState,
      attendees: ["alice@example.com"],
    });
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("passes for example.org attendee addresses", () => {
    const issues = validateCalendarEventEditor({
      ...validState,
      attendees: ["bob@example.org"],
    });
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("passes for subdomain stealth.demo attendee addresses", () => {
    const issues = validateCalendarEventEditor({
      ...validState,
      attendees: ["user@relay.stealth.demo"],
    });
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("sets the correct datasetId", () => {
    const issues = validateCalendarEventEditor({ ...validState, title: "" });
    for (const issue of issues) {
      expect(issue.datasetId).toBe("calendar-event-editor");
    }
  });
});
