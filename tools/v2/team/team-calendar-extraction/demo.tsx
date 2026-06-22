/**
 * Team Calendar Extraction Tool - Demo & Testing Setup
 *
 * This file demonstrates how to use the Team Calendar Extraction tool
 * in a demo or testing environment.
 *
 * For production integration, see README.md and docs/
 */

import React from "react";
import { TeamCalendarExtractionTool } from "./components/team-calendar-extraction-tool";
import { mockCalendarEvents, mockExtractionRequests } from "./fixtures/calendar.fixtures";

/**
 * Demo component showing the tool in action
 */
export function TeamCalendarExtractionDemo() {
  return (
    <div className="w-full min-h-screen bg-background">
      <TeamCalendarExtractionTool
        events={mockCalendarEvents}
        extractionRequests={mockExtractionRequests}
        isLoading={false}
      />
    </div>
  );
}

/**
 * Minimal usage example
 */
export function MinimalExample() {
  return (
    <TeamCalendarExtractionTool
      events={mockCalendarEvents}
      onExtract={async (request) => {
        // Simulated extraction
        console.log("Extracting:", request.title);
        return {
          requestId: request.id,
          totalEvents: request.events.length,
          successfulExtractions: request.events.length,
          failedExtractions: 0,
          events: request.events,
          extractedAt: new Date(),
          duration: 500,
        };
      }}
    />
  );
}

/**
 * With loading state example
 */
export function WithLoadingState() {
  return <TeamCalendarExtractionTool events={[]} isLoading />;
}

/**
 * With error state example
 */
export function WithErrorState() {
  return (
    <TeamCalendarExtractionTool
      events={[]}
      error="Failed to connect to calendar source. Please check your permissions and try again."
    />
  );
}

/**
 * Empty state example
 */
export function EmptyStateExample() {
  return <TeamCalendarExtractionTool events={[]} />;
}

export default TeamCalendarExtractionDemo;
