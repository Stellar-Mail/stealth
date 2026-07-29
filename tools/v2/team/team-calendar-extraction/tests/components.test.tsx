// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { EventList } from "../components/EventList";
import { StatusIndicators } from "../components/StatusIndicators";
import type { CalendarEvent, ExtractionStats } from "../types";

function sampleEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-001",
    title: "Sprint Planning",
    description: "Plan the upcoming sprint.",
    startDate: "2026-07-12T14:00:00.000Z",
    endDate: "2026-07-12T15:30:00.000Z",
    location: "Google Meet",
    organizer: "scrum@company.com",
    attendees: ["dev1@company.com", "dev2@company.com"],
    isSanitized: true,
    ...overrides,
  };
}

describe("EventList", () => {
  it("renders empty state when there are no events", () => {
    render(<EventList events={[]} />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("No events successfully extracted yet.")).toBeTruthy();
  });

  it("renders a list of events", () => {
    const events = [sampleEvent(), sampleEvent({ id: "evt-002", title: "Review Meeting" })];
    render(<EventList events={events} />);
    expect(screen.getByText("Sprint Planning")).toBeTruthy();
    expect(screen.getByText("Review Meeting")).toBeTruthy();
    expect(screen.getByText("Extracted Events (2)")).toBeTruthy();
  });

  it("renders event metadata", () => {
    render(<EventList events={[sampleEvent()]} />);
    expect(screen.getByText("Sprint Planning")).toBeTruthy();
    expect(screen.getByText(/scrum@company\.com/)).toBeTruthy();
    expect(screen.getByText(/Google Meet/)).toBeTruthy();
  });

  it("renders attendees as a list", () => {
    render(<EventList events={[sampleEvent()]} />);
    expect(screen.getByText("dev1@company.com")).toBeTruthy();
    expect(screen.getByText("dev2@company.com")).toBeTruthy();
  });

  it("marks single events appropriately", () => {
    render(<EventList events={[sampleEvent()]} />);
    expect(screen.getByText("Single Event")).toBeTruthy();
  });

  it("marks recurring events", () => {
    render(<EventList events={[sampleEvent({ recurrence: "FREQ=WEEKLY" })]} />);
    expect(screen.getByText("Recurring")).toBeTruthy();
  });

  it("empty state has role=status and is focusable", () => {
    render(<EventList events={[]} />);
    const emptyState = screen.getByRole("status");
    expect(emptyState.getAttribute("tabindex")).toBe("-1");
    expect(emptyState.getAttribute("aria-label")).toBe("No events extracted");
  });

  it("renders event list as a ul element", () => {
    render(<EventList events={[sampleEvent()]} />);
    const lists = screen.getAllByRole("list");
    const eventList = lists.find(
      (l) => l.getAttribute("aria-label") === "Extracted calendar events",
    );
    expect(eventList).toBeTruthy();
  });
});

describe("StatusIndicators", () => {
  it("shows placeholder when stats are null", () => {
    render(<StatusIndicators stats={null} errors={[]} logs={[]} />);
    expect(screen.getByText("Run extraction to view stats.")).toBeTruthy();
  });

  it("displays extraction statistics", () => {
    const stats: ExtractionStats = {
      bytesProcessed: 2048,
      timeElapsedMs: 150,
      eventsFound: 5,
      eventsExtracted: 3,
      sanitizationActions: 2,
    };
    render(<StatusIndicators stats={stats} errors={[]} logs={[]} />);
    expect(screen.getByText("2.00 KB")).toBeTruthy();
    expect(screen.getByText("150 ms")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("renders processing logs", () => {
    render(
      <StatusIndicators
        stats={null}
        errors={[]}
        logs={["Processing file...", "Extracted 2 events."]}
      />,
    );
    expect(screen.getByText("Processing file...")).toBeTruthy();
    expect(screen.getByText("Extracted 2 events.")).toBeTruthy();
  });

  it("displays errors with alert role", () => {
    render(<StatusIndicators stats={null} errors={["Invalid event: missing title"]} logs={[]} />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
    expect(screen.getByText("Invalid event: missing title")).toBeTruthy();
  });

  it("shows warning count badge", () => {
    render(<StatusIndicators stats={null} errors={["Error 1", "Error 2"]} logs={[]} />);
    expect(screen.getByText("2 Warnings")).toBeTruthy();
  });

  it("log region has role=log", () => {
    render(<StatusIndicators stats={null} errors={[]} logs={["test"]} />);
    const log = screen.getByRole("log");
    expect(log).toBeTruthy();
    expect(log.getAttribute("aria-live")).toBe("polite");
  });

  it("renders performance telemetry in a region", () => {
    render(<StatusIndicators stats={null} errors={[]} logs={[]} />);
    expect(screen.getByText("Performance Telemetry")).toBeTruthy();
  });

  it("renders safety scanner output in a region", () => {
    render(<StatusIndicators stats={null} errors={[]} logs={[]} />);
    expect(screen.getByText("Safety Scanner Output")).toBeTruthy();
  });
});
