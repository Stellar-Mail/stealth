import { useCallback, useId, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import type { DateRange } from "../types";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const startId = useId();
  const endId = useId();
  const formId = useId();
  const [focusedField, setFocusedField] = useState<"start" | "end" | null>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  const handleStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newStart = e.target.value;
      onChange({ start: newStart, end: value.end });
    },
    [onChange, value.end],
  );

  const handleEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newEnd = e.target.value;
      onChange({ start: value.start, end: newEnd });
    },
    [onChange, value.start],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent, field: "start" | "end") => {
    if (e.key === "Escape") {
      (field === "start" ? startRef : endRef).current?.blur();
    }
    if (e.key === "Enter") {
      if (field === "start") {
        endRef.current?.focus();
      }
    }
  }, []);

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      role="search"
      aria-label="Filter by date range"
    >
      <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
      <div className="flex items-center gap-2">
        <label htmlFor={startId} className="sr-only">
          Start date
        </label>
        <input
          ref={startRef}
          id={startId}
          type="date"
          value={toDateInputValue(value.start)}
          onChange={handleStartChange}
          onFocus={() => setFocusedField("start")}
          onBlur={() => setFocusedField(null)}
          onKeyDown={(e) => handleKeyDown(e, "start")}
          aria-label="Start date"
          className="rounded-lg border border-border/30 bg-white/[0.04] px-3 py-1.5 text-sm text-foreground transition-colors focus:border-ring/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <span className="text-xs text-muted-foreground" aria-hidden="true">
          to
        </span>
        <label htmlFor={endId} className="sr-only">
          End date
        </label>
        <input
          ref={endRef}
          id={endId}
          type="date"
          value={toDateInputValue(value.end)}
          onChange={handleEndChange}
          onFocus={() => setFocusedField("end")}
          onBlur={() => setFocusedField(null)}
          onKeyDown={(e) => handleKeyDown(e, "end")}
          aria-label="End date"
          className="rounded-lg border border-border/30 bg-white/[0.04] px-3 py-1.5 text-sm text-foreground transition-colors focus:border-ring/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <p className="sr-only" aria-live="polite" role="status">
        {focusedField === "start"
          ? "Start date field focused"
          : focusedField === "end"
            ? "End date field focused"
            : ""}
      </p>
    </div>
  );
}
