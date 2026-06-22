import React, { useState } from "react";
import { useCalendarExtraction } from "../hooks/use-calendar-extraction";
import { EventList } from "./EventList";
import { StatusIndicators } from "./StatusIndicators";
import {
  validEmails,
  maliciousEmails,
  generateLargeIcsContent,
  generateOverlyLongLineIcs,
} from "../fixtures/calendar.fixtures";

export function TeamCalendarExtraction() {
  const { isProcessing, events, stats, errors, logs, processEmails, processIcsFile, clear } =
    useCalendarExtraction();

  const [customIcs, setCustomIcs] = useState("");

  const handleProcessEmails = (type: "valid" | "malicious") => {
    const data = type === "valid" ? validEmails : maliciousEmails;
    processEmails(data);
  };

  const handleProcessLargeIcs = () => {
    // Stress test: 150 events
    const content = generateLargeIcsContent(150);
    processIcsFile(content, "performance_stress_test.ics");
  };

  const handleProcessLongLineIcs = () => {
    const content = generateOverlyLongLineIcs();
    processIcsFile(content, "long_line_exploit.ics");
  };

  const handleProcessCustomIcs = () => {
    if (!customIcs.trim()) return;
    processIcsFile(customIcs, "custom_user_calendar.ics");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 bg-zinc-950/40 text-zinc-100 rounded-3xl border border-zinc-800/80 shadow-2xl backdrop-blur-xl">
      {/* Tool Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Team Calendar Extraction Console
          </h2>
          <p className="text-sm text-zinc-400 mt-1.5">
            Safe, resource-bounded extraction of iCalendar invites and meeting schedules from team
            mail streams.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clear}
            className="px-4 py-2 text-xs font-semibold bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg transition"
          >
            Reset Tool
          </button>
        </div>
      </div>

      {/* Control Panel Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Panel: Simulated Datasets */}
        <div className="p-6 border border-zinc-800/60 rounded-2xl bg-zinc-900/20 backdrop-blur-md space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Simulated Inbox Feeds
          </h3>
          <p className="text-xs text-zinc-400">
            Simulate scanning of email folders or loading of attachments with security scanning
            active.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleProcessEmails("valid")}
              disabled={isProcessing}
              className="flex flex-col items-center justify-center p-4 border border-zinc-800 rounded-xl hover:bg-zinc-900/60 hover:border-emerald-500/30 transition text-center group disabled:opacity-55"
            >
              <span className="text-2xl mb-1 group-hover:scale-105 transition-transform">📬</span>
              <span className="text-xs font-semibold text-zinc-200">Standard Feed</span>
              <span className="text-[10px] text-zinc-500 mt-1">2 normal emails</span>
            </button>

            <button
              onClick={() => handleProcessEmails("malicious")}
              disabled={isProcessing}
              className="flex flex-col items-center justify-center p-4 border border-zinc-800 rounded-xl hover:bg-zinc-900/60 hover:border-rose-500/30 transition text-center group disabled:opacity-55"
            >
              <span className="text-2xl mb-1 group-hover:scale-105 transition-transform">⚠️</span>
              <span className="text-xs font-semibold text-zinc-200">Malicious/XSS Feed</span>
              <span className="text-[10px] text-zinc-500 mt-1">Contains exploits</span>
            </button>
          </div>

          <div className="pt-2 border-t border-zinc-800/60 space-y-2">
            <p className="text-xs font-medium text-zinc-400">Stress & Attack Simulations:</p>
            <div className="flex gap-2">
              <button
                onClick={handleProcessLargeIcs}
                disabled={isProcessing}
                className="flex-1 px-3 py-2 text-[11px] font-semibold bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 hover:bg-zinc-800 text-zinc-300 rounded-lg transition disabled:opacity-55"
              >
                150 Events DoS Test
              </button>
              <button
                onClick={handleProcessLongLineIcs}
                disabled={isProcessing}
                className="flex-1 px-3 py-2 text-[11px] font-semibold bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 hover:bg-zinc-800 text-zinc-300 rounded-lg transition disabled:opacity-55"
              >
                Long Property Attack
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Custom Paste area */}
        <div className="p-6 border border-zinc-800/60 rounded-2xl bg-zinc-900/20 backdrop-blur-md flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
              Paste iCalendar (.ics) Content
            </h3>
            <p className="text-xs text-zinc-400">
              Paste raw iCalendar text to test safety boundaries (file size, lines limit, malformed
              tokens).
            </p>
          </div>
          <textarea
            value={customIcs}
            onChange={(e) => setCustomIcs(e.target.value)}
            placeholder="BEGIN:VCALENDAR&#10;VERSION:2.0&#10;BEGIN:VEVENT&#10;SUMMARY:Meeting Summary...&#10;END:VEVENT&#10;END:VCALENDAR"
            className="flex-1 w-full min-h-[120px] p-3 text-xs bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-zinc-300 focus:outline-none focus:border-zinc-700 placeholder-zinc-700 resize-none"
          />
          <button
            onClick={handleProcessCustomIcs}
            disabled={isProcessing || !customIcs.trim()}
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs transition disabled:opacity-50"
          >
            {isProcessing ? "Processing..." : "Parse Pasted Calendar"}
          </button>
        </div>
      </div>

      {/* Loading overlay if working */}
      {isProcessing && (
        <div className="py-8 flex justify-center items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-sky-500 border-t-transparent" />
          <span className="text-sm font-medium text-zinc-400">
            Scanning content and executing threat-guards...
          </span>
        </div>
      )}

      {/* Telemetry and Logs */}
      <StatusIndicators stats={stats} errors={errors} logs={logs} />

      {/* Output list of events */}
      <div className="border-t border-zinc-800 pt-6">
        <EventList events={events} />
      </div>
    </div>
  );
}
export default TeamCalendarExtraction;
