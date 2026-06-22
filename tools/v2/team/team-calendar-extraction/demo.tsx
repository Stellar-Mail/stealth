import React from "react";
import { TeamCalendarExtraction } from "./components/TeamCalendarExtraction";

/**
 * Team Calendar Extraction - Security & Performance Demo Harness
 */
export function TeamCalendarExtractionDemo() {
  return (
    <div className="w-full min-h-screen bg-zinc-950 p-6 md:p-12 flex items-center justify-center">
      <div className="w-full max-w-6xl">
        <TeamCalendarExtraction />
      </div>
    </div>
  );
}

export default TeamCalendarExtractionDemo;
