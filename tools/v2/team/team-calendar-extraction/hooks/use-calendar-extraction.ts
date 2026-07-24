import { useState, useCallback } from "react";
import { CalendarEvent, EmailData, ExtractionStats } from "../types";
import { processTeamEmails } from "../services/extraction.service";
import { parseIcsContent } from "../services/ics-parser";
import { sanitizeFilename } from "../services/sanitization";
import { validateCalendarEvent } from "../services/validation";

export function useCalendarExtraction() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [stats, setStats] = useState<ExtractionStats | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  const processEmails = useCallback(async (emails: EmailData[]) => {
    setIsProcessing(true);
    setErrors([]);
    setLogs(["Initiating team email scanning batch..."]);

    // Delay briefly to allow UI to render spinner and simulate asynchronous parsing
    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
      const result = processTeamEmails(emails);

      setEvents(result.events);
      setStats(result.stats);
      setLogs((prev) => [
        ...prev,
        ...result.sanitizationLog,
        `Finished scanning. Processed ${result.stats.bytesProcessed} bytes in ${result.stats.timeElapsedMs}ms.`,
      ]);

      if (result.errors.length > 0) {
        setErrors(result.errors.map((e) => `[Email ${e.emailId}]: ${e.message}`));
      }
    } catch (err) {
      setErrors([(err as Error).message || "An unexpected error occurred during email extraction"]);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const processIcsFile = useCallback(async (fileContent: string, filename: string) => {
    setIsProcessing(true);
    setErrors([]);
    const safeName = sanitizeFilename(filename);
    setLogs([`Reading calendar file: ${safeName}...`]);
    const startTime = Date.now();

    await new Promise((resolve) => setTimeout(resolve, 400));

    try {
      const byteLength = new Blob([fileContent]).size;
      const parseResult = parseIcsContent(fileContent);

      const validatedEvents: CalendarEvent[] = [];
      const validationErrors: string[] = [];

      parseResult.events.forEach((evt) => {
        const validation = validateCalendarEvent(evt);
        if (validation.valid) {
          validatedEvents.push(evt);
        } else {
          validationErrors.push(
            `Event "${evt.title}" failed validation: ${validation.errors
              .map((e) => e.message)
              .join(", ")}`,
          );
        }
      });

      setEvents(validatedEvents);
      setErrors([...parseResult.errors, ...validationErrors]);

      const timeElapsedMs = Date.now() - startTime;
      setStats({
        bytesProcessed: byteLength,
        timeElapsedMs,
        eventsFound: parseResult.events.length,
        eventsExtracted: validatedEvents.length,
        sanitizationActions: parseResult.errors.length,
      });

      setLogs((prev) => [
        ...prev,
        `ICS file parsed successfully. Extracted ${validatedEvents.length} events.`,
      ]);
    } catch (err) {
      setErrors([(err as Error).message || "Failed to process ICS file"]);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
    setStats(null);
    setErrors([]);
    setLogs([]);
    setIsProcessing(false);
  }, []);

  return {
    isProcessing,
    events,
    stats,
    errors,
    logs,
    processEmails,
    processIcsFile,
    clear,
  };
}
